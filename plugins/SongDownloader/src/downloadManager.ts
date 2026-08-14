import { Tracer, type LunaUnload } from "@luna/core";
import { MediaItem, safeInterval, type MediaCollection, type MediaFormat } from "@luna/lib";
import { getDownloadFolder, getDownloadPath, getFileName } from "./helpers";
import { settings } from "./Settings";

const { trace } = Tracer("[SongDownloader:Manager]");

export type TrackStatus = "queued" | "checking" | "downloading" | "completed" | "error" | "cancelled";

export const formatAudioDetails = (format?: MediaFormat): string | undefined => {
	if (!format) return undefined;
	const parts: string[] = [];
	if (format.bitDepth) {
		parts.push(`${format.bitDepth}-bit`);
	}
	if (format.sampleRate) {
		const kHz = (format.sampleRate / 1000).toFixed(format.sampleRate % 1000 === 0 ? 0 : 1);
		parts.push(`${kHz} kHz`);
	}
	if (format.bitrate) {
		const kbps = Math.round(format.bitrate / 1000);
		parts.push(`${kbps} kbps`);
	} else if (format.codec) {
		parts.push(format.codec.toUpperCase());
	}
	return parts.length > 0 ? parts.join(" • ") : undefined;
};

export interface QueueTrack {
	id: string;
	index: number;
	title: string;
	artist: string;
	album?: string;
	coverUrl?: string;
	qualityName?: string;
	formatInfo?: string;
	audioFormat?: MediaFormat;
	status: TrackStatus;
	statusText?: string;
	progressPercent: number;
	downloadedMB: string;
	totalMB: string;
	error?: string;
	filePath?: string;
	mediaItem: MediaItem;
}

export interface QueueState {
	isOpen: boolean;
	isMinimized: boolean;
	batchTitle: string;
	tracks: QueueTrack[];
	activeTrackId?: string;
	status: "idle" | "running" | "cancelling" | "completed" | "error";
	downloadFolder?: string;
	completedCount: number;
	errorCount: number;
	totalCount: number;
	overallPercent: number;
	useRealMAX: boolean;
}

class DownloadManager {
	private state: QueueState = {
		isOpen: false,
		isMinimized: false,
		batchTitle: "Downloads",
		tracks: [],
		status: "idle",
		completedCount: 0,
		errorCount: 0,
		totalCount: 0,
		overallPercent: 0,
		useRealMAX: settings.useRealMAX,
	};

	private listeners = new Set<(state: QueueState) => void>();
	private cancelRequested = false;
	private isProcessing = false;
	public unloads = new Set<LunaUnload>();

	public getState(): QueueState {
		return {
			...this.state,
			useRealMAX: settings.useRealMAX,
		};
	}

	public setRealMAX(enabled: boolean) {
		settings.useRealMAX = enabled;
		this.state.useRealMAX = enabled;
		this.notify();
	}

	public subscribe(listener: (state: QueueState) => void): () => void {
		this.listeners.add(listener);
		listener(this.getState());
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify() {
		const completed = this.state.tracks.filter((t) => t.status === "completed").length;
		const error = this.state.tracks.filter((t) => t.status === "error").length;
		const total = this.state.tracks.length;

		this.state.completedCount = completed;
		this.state.errorCount = error;
		this.state.totalCount = total;
		this.state.useRealMAX = settings.useRealMAX;

		if (total > 0) {
			const sumPercent = this.state.tracks.reduce((acc, t) => {
				if (t.status === "completed") return acc + 100;
				return acc + (t.progressPercent || 0);
			}, 0);
			this.state.overallPercent = Math.round(sumPercent / total);
		} else {
			this.state.overallPercent = 0;
		}

		const snapshot = this.getState();
		this.listeners.forEach((fn) => {
			try {
				fn(snapshot);
			} catch (e) {
				trace.err.withContext("notify.listener")(e as Error);
			}
		});
	}

	public openModal() {
		this.state.isOpen = true;
		this.state.isMinimized = false;
		this.notify();
	}

	public closeModal() {
		this.state.isOpen = false;
		this.notify();
	}

	public toggleModal() {
		this.state.isOpen = !this.state.isOpen;
		if (this.state.isOpen) this.state.isMinimized = false;
		this.notify();
	}

	public setMinimized(minimized: boolean) {
		this.state.isMinimized = minimized;
		this.notify();
	}

	public cancel() {
		if (this.state.status === "running") {
			this.cancelRequested = true;
			this.state.status = "cancelling";
			this.notify();
		}
	}

	public clearFinished() {
		this.state.tracks = this.state.tracks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
		if (this.state.tracks.length === 0) {
			this.state.status = "idle";
			this.state.activeTrackId = undefined;
		}
		this.notify();
	}

	public clearAll() {
		if (this.state.status === "running") {
			this.cancel();
		}
		this.state.tracks = [];
		this.state.activeTrackId = undefined;
		this.state.status = "idle";
		this.state.completedCount = 0;
		this.state.errorCount = 0;
		this.state.totalCount = 0;
		this.state.overallPercent = 0;
		this.notify();
	}

	public async retryTrack(id: string) {
		const track = this.state.tracks.find((t) => t.id === id);
		if (!track) return;
		track.status = "queued";
		track.statusText = "Queued for retry";
		track.error = undefined;
		track.progressPercent = 0;
		track.downloadedMB = "0";
		track.totalMB = "0";
		this.notify();

		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	public async retryAllFailed() {
		let hasFailed = false;
		for (const track of this.state.tracks) {
			if (track.status === "error" || track.status === "cancelled") {
				track.status = "queued";
				track.statusText = "Queued for retry";
				track.error = undefined;
				track.progressPercent = 0;
				track.downloadedMB = "0";
				track.totalMB = "0";
				hasFailed = true;
			}
		}
		if (hasFailed) {
			this.notify();
			if (!this.isProcessing) {
				this.processQueue();
			}
		}
	}

	/**
	 * Start downloading a collection of media items
	 */
	public async startDownload(mediaCollection: MediaCollection, customTitle?: string) {
		const count = await mediaCollection.count().catch(() => 0);
		if (count === 0) return;

		// 1. Resolve collection title
		const colTitle = customTitle ?? (await mediaCollection.title().catch(() => undefined));
		const batchName = colTitle ? (count > 1 ? `Playlist: ${colTitle}` : colTitle) : count > 1 ? `Downloading ${count} tracks` : "Download Track";

		// 2. Resolve destination folder
		let downloadFolder: string | undefined = settings.defaultPath;
		if (downloadFolder === undefined && count > 1) {
			downloadFolder = await getDownloadFolder();
			if (downloadFolder === undefined) return; // User cancelled folder picker
		}

		this.state.downloadFolder = downloadFolder;
		this.state.batchTitle = batchName;
		this.state.isOpen = true;
		this.state.isMinimized = false;
		this.cancelRequested = false;

		// 3. Load items into queue
		let index = this.state.tracks.length + 1;
		const newTracks: QueueTrack[] = [];

		try {
			for await (const mediaItem of await mediaCollection.mediaItems()) {
				const trackTitle = mediaItem.tidalItem.title ?? "Unknown Title";
				const artistName =
					mediaItem.tidalItem.artists?.map((a) => a.name).join(", ") ?? mediaItem.tidalItem.artist?.name ?? "Unknown Artist";
				const albumTitle = mediaItem.tidalItem.album?.title;
				const qualityName = mediaItem.bestQuality?.name;

				const trackItem: QueueTrack = {
					id: `${mediaItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
					index: index++,
					title: trackTitle,
					artist: artistName,
					album: albumTitle,
					qualityName,
					status: "queued",
					statusText: "Waiting in queue...",
					progressPercent: 0,
					downloadedMB: "0",
					totalMB: "0",
					mediaItem,
				};

				// Pre-fetch cover url asynchronously
				mediaItem
					.coverUrl({ res: "160" })
					.then((url) => {
						if (url) {
							trackItem.coverUrl = url;
							this.notify();
						}
					})
					.catch(() => {});

				// Pre-fetch format info if already available in cache
				mediaItem
					.updateFormat(settings.downloadQuality)
					.then((fmt) => {
						if (fmt) {
							trackItem.audioFormat = fmt;
							trackItem.formatInfo = formatAudioDetails(fmt);
							this.notify();
						}
					})
					.catch(() => {});

				newTracks.push(trackItem);
			}
		} catch (err) {
			trace.err.withContext("startDownload.loadItems")(err as Error);
		}

		if (newTracks.length === 0) return;

		this.state.tracks = [...this.state.tracks, ...newTracks];
		this.notify();

		if (!this.isProcessing) {
			this.processQueue();
		}
	}

	/**
	 * Sequential download worker
	 */
	private async processQueue() {
		if (this.isProcessing) return;
		this.isProcessing = true;
		this.state.status = "running";
		this.cancelRequested = false;
		this.notify();

		try {
			while (true) {
				const nextTrack = this.state.tracks.find((t) => t.status === "queued");
				if (!nextTrack || this.cancelRequested) break;

				await this.downloadSingleTrack(nextTrack);
			}
		} finally {
			this.isProcessing = false;
			this.state.activeTrackId = undefined;

			if (this.cancelRequested) {
				this.state.status = "cancelled";
				for (const t of this.state.tracks) {
					if (t.status === "queued") {
						t.status = "cancelled";
						t.statusText = "Cancelled";
					}
				}
			} else {
				const hasErrors = this.state.tracks.some((t) => t.status === "error");
				this.state.status = hasErrors ? "error" : "completed";
			}

			this.cancelRequested = false;
			this.notify();
		}
	}

	private async downloadSingleTrack(track: QueueTrack) {
		this.state.activeTrackId = track.id;
		track.status = "checking";
		track.statusText = settings.useRealMAX ? "RealMAX: Searching highest FLAC quality..." : "Reading metadata & quality...";
		this.notify();

		let mediaItem = track.mediaItem;

		try {
			// RealMAX check
			if (settings.useRealMAX) {
				const maxItem = await mediaItem.max().catch(() => undefined);
				if (maxItem) {
					mediaItem = maxItem;
					track.mediaItem = maxItem;
				}
			}

			// Update track info & format
			track.qualityName = mediaItem.bestQuality?.name ?? track.qualityName;
			if (!track.coverUrl) {
				track.coverUrl = await mediaItem.coverUrl({ res: "160" }).catch(() => undefined);
			}

			// Fetch exact audio format specs (bit depth, sample rate, bitrate)
			const fmt = await mediaItem.updateFormat(settings.downloadQuality).catch(() => undefined);
			if (fmt) {
				track.audioFormat = fmt;
				track.formatInfo = formatAudioDetails(fmt);
			}

			if (this.cancelRequested) {
				track.status = "cancelled";
				track.statusText = "Cancelled";
				this.notify();
				return;
			}

			track.statusText = "Fetching tags and filename...";
			this.notify();

			const { tags } = await mediaItem.flacTags();
			const fileName = await getFileName(mediaItem, settings.downloadQuality);

			let path: string | string[] | undefined;
			if (this.state.downloadFolder !== undefined) {
				path = [this.state.downloadFolder, fileName];
			} else {
				path = await getDownloadPath(fileName);
			}

			if (path === undefined) {
				track.status = "cancelled";
				track.statusText = "Cancelled (no path chosen)";
				this.notify();
				return;
			}

			track.status = "downloading";
			track.statusText = "Starting download...";
			this.notify();

			// Progress monitor interval
			let stopProgress = false;
			const progressInterval = safeInterval(
				this.unloads,
				async () => {
					if (stopProgress) return;
					const progress = await mediaItem.downloadProgress().catch(() => undefined);
					if (!progress) return;
					const { total, downloaded } = progress;
					if (total === undefined || downloaded === undefined || total === 0) return;

					const percent = Math.min(100, Math.round((downloaded / total) * 100));
					const downloadedMB = (downloaded / 1048576).toFixed(1);
					const totalMB = (total / 1048576).toFixed(1);

					track.progressPercent = percent;
					track.downloadedMB = downloadedMB;
					track.totalMB = totalMB;
					track.statusText = `Downloading: ${downloadedMB} / ${totalMB} MB (${percent}%)`;
					this.notify();
				},
				100,
			);

			try {
				await mediaItem.download(path, settings.downloadQuality);
				stopProgress = true;
				progressInterval();

				// Ensure format info is populated on complete
				if (!track.formatInfo) {
					const finalFmt = await mediaItem.updateFormat(settings.downloadQuality).catch(() => undefined);
					if (finalFmt) {
						track.audioFormat = finalFmt;
						track.formatInfo = formatAudioDetails(finalFmt);
					}
				}

				track.status = "completed";
				track.progressPercent = 100;
				track.statusText = track.formatInfo ? `Downloaded (${track.formatInfo})` : "Completed";
				track.filePath = Array.isArray(path) ? path.join("/") : path;
			} catch (downloadErr) {
				stopProgress = true;
				progressInterval();
				throw downloadErr;
			}
		} catch (err) {
			trace.err.withContext(`Failed to download ${track.title}`)(err as Error);
			track.status = "error";
			track.error = (err as Error)?.message || "Download failed";
			track.statusText = `Error: ${track.error}`;
		} finally {
			this.notify();
		}
	}
}

export const downloadManager = new DownloadManager();
