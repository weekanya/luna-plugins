import { Tracer, type LunaUnload } from "@luna/core";
import { MediaItem, safeInterval, type MediaCollection, type MediaFormat } from "@luna/lib";
import {
	deleteCorruptFile,
	fileExists,
	getNativeDownloadProgress,
	nativeDownloadTrack,
	saveLyricsFile,
	saveTextFile,
	verifyAudioFileIntegrity,
} from "./fileUtils.native";
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
	status: "idle" | "running" | "cancelling" | "completed" | "error" | "cancelled";
	downloadFolder?: string;
	completedCount: number;
	errorCount: number;
	totalCount: number;
	overallPercent: number;
	useRealMAX: boolean;
	concurrentDownloads: number;
	dynamicTheme: boolean;
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
		useRealMAX: settings.useRealMAX ?? true,
		concurrentDownloads: settings.concurrentDownloads ?? 2,
		dynamicTheme: settings.dynamicTheme ?? true,
	};

	private listeners = new Set<(state: QueueState) => void>();
	private cancelRequested = false;
	private activeWorkers = 0;
	public unloads = new Set<LunaUnload>();

	public getState(): QueueState {
		return {
			...this.state,
			useRealMAX: settings.useRealMAX ?? true,
			concurrentDownloads: settings.concurrentDownloads ?? 2,
			dynamicTheme: settings.dynamicTheme ?? true,
		};
	}

	public setRealMAX(enabled: boolean) {
		settings.useRealMAX = enabled;
		this.state.useRealMAX = enabled;
		this.notify();
	}

	public setConcurrentDownloads(count: number) {
		const val = Math.max(1, Math.min(4, count));
		settings.concurrentDownloads = val;
		this.state.concurrentDownloads = val;
		this.notify();
		if (this.state.status === "running") {
			this.triggerQueue();
		}
	}

	public setDynamicTheme(enabled: boolean) {
		settings.dynamicTheme = enabled;
		this.state.dynamicTheme = enabled;
		this.notify();
	}

	public notifySettingsChanged() {
		this.state.useRealMAX = settings.useRealMAX ?? true;
		this.state.concurrentDownloads = settings.concurrentDownloads ?? 2;
		this.state.dynamicTheme = settings.dynamicTheme ?? true;
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
		this.state.useRealMAX = settings.useRealMAX ?? true;
		this.state.concurrentDownloads = settings.concurrentDownloads ?? 2;
		this.state.dynamicTheme = settings.dynamicTheme ?? true;

		if (total > 0) {
			const sumPercent = this.state.tracks.reduce((acc, t) => {
				if (t.status === "completed") return acc + 100;
				return acc + (t.progressPercent || 0);
			}, 0);
			this.state.overallPercent = Math.round(sumPercent / total);
		} else {
			this.state.overallPercent = 0;
		}

		// Pick currently active downloading/checking track
		const active =
			this.state.tracks.find((t) => t.status === "downloading") ||
			this.state.tracks.find((t) => t.status === "checking");
		this.state.activeTrackId = active?.id;

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
		this.cancelRequested = true;
		this.state.status = "cancelling";
		for (const t of this.state.tracks) {
			if (t.status === "queued") {
				t.status = "cancelled";
				t.statusText = "Cancelled";
			}
		}
		this.notify();

		if (this.activeWorkers === 0) {
			this.state.status = "cancelled";
			this.cancelRequested = false;
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
		this.cancelRequested = true;
		this.state.tracks = [];
		this.state.activeTrackId = undefined;
		this.state.status = "idle";
		this.state.completedCount = 0;
		this.state.errorCount = 0;
		this.state.totalCount = 0;
		this.state.overallPercent = 0;
		this.cancelRequested = false;
		this.notify();
	}

	public async exportTracklistTxt(): Promise<string | undefined> {
		if (this.state.tracks.length === 0) return undefined;

		const headerLines = [
			`=======================================================`,
			`🎵 ${this.state.batchTitle.toUpperCase()}`,
			`📊 Всего треков: ${this.state.tracks.length}`,
			`📅 Дата экспорта: ${new Date().toLocaleString()}`,
			`=======================================================`,
			"",
		];

		const trackLines = this.state.tracks.map((t, idx) => {
			const albumStr = t.album ? ` - ${t.album}` : "";
			return `${idx + 1}. ${t.artist}${albumStr} - ${t.title}`;
		});

		const content = [...headerLines, ...trackLines].join("\n");

		try {
			if (navigator?.clipboard) {
				await navigator.clipboard.writeText(content);
			}
		} catch (_) {}

		const cleanTitle = this.state.batchTitle.replace(/[^\w\s-]/g, "").trim() || "Tracklist";
		const fileName = `${cleanTitle}.txt`;
		const saveDir = this.state.downloadFolder || settings.defaultPath;
		return saveTextFile(saveDir, fileName, content);
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
		this.cancelRequested = false;
		this.notify();

		this.triggerQueue();
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
			this.cancelRequested = false;
			this.notify();
			this.triggerQueue();
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
		this.cancelRequested = false;
		this.notify();

		this.triggerQueue();
	}

	/**
	 * Worker pool trigger with true multi-threading concurrency
	 */
	private triggerQueue() {
		if (this.cancelRequested || this.state.status === "cancelling") {
			if (this.activeWorkers === 0) {
				this.state.status = "cancelled";
				this.cancelRequested = false;
				this.notify();
			}
			return;
		}

		const maxWorkers = Math.max(1, Math.min(4, settings.concurrentDownloads || 2));
		const queuedCount = this.state.tracks.filter((t) => t.status === "queued").length;

		if (queuedCount === 0 && this.activeWorkers === 0) {
			if (this.state.status === "running") {
				const hasErrors = this.state.tracks.some((t) => t.status === "error");
				this.state.status = hasErrors ? "error" : "completed";
				this.notify();
			}
			return;
		}

		this.state.status = "running";

		while (this.activeWorkers < maxWorkers) {
			if (this.cancelRequested || this.state.status === "cancelling" || this.state.status === "cancelled") break;
			const nextTrack = this.state.tracks.find((t) => t.status === "queued");
			if (!nextTrack) break;

			this.activeWorkers++;
			nextTrack.status = "checking";
			this.notify();

			this.downloadSingleTrack(nextTrack).finally(() => {
				this.activeWorkers--;
				this.notify();
				this.triggerQueue();
			});
		}
	}

	private async downloadSingleTrack(track: QueueTrack) {
		track.status = "checking";
		track.statusText = settings.useRealMAX ? "RealMAX: Finding highest FLAC..." : "Checking metadata...";
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

			// Fetch exact audio format specs
			const fmt = await mediaItem.updateFormat(settings.downloadQuality).catch(() => undefined);
			if (fmt) {
				track.audioFormat = fmt;
				track.formatInfo = formatAudioDetails(fmt);
			}

			if (this.cancelRequested || this.state.status === "cancelling" || this.state.status === "cancelled") {
				track.status = "cancelled";
				track.statusText = "Cancelled";
				this.notify();
				return;
			}

			track.statusText = "Resolving path and tags...";
			this.notify();

			const [playbackInfo, flacTags, fileName] = await Promise.all([
				mediaItem.playbackInfo(settings.downloadQuality),
				mediaItem.flacTags(),
				getFileName(mediaItem, settings.downloadQuality),
			]);

			if (!playbackInfo) {
				throw new Error(`Track ${track.title} is not available for download`);
			}

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

			track.filePath = Array.isArray(path) ? path.join("/") : path;

			// Smart Skip check + Audio Integrity Verification
			if (settings.skipExisting && (await fileExists(path))) {
				let isCorrupted = false;

				if (settings.verifyIntegrity) {
					const integrity = await verifyAudioFileIntegrity(path);
					if (!integrity.isValid) {
						isCorrupted = true;
						trace.warn(`Existing file corrupted for ${track.title}: ${integrity.error}. Re-downloading cleanly...`);
						await deleteCorruptFile(path);
					}
				}

				if (!isCorrupted) {
					track.status = "completed";
					track.progressPercent = 100;
					track.statusText = track.formatInfo ? `Verified (${track.formatInfo})` : "Verified & Already exists";
					this.notify();
					return;
				}
			}

			if (this.cancelRequested || this.state.status === "cancelling" || this.state.status === "cancelled") {
				track.status = "cancelled";
				track.statusText = "Cancelled";
				this.notify();
				return;
			}

			track.status = "downloading";
			track.statusText = "Starting download...";
			this.notify();

			// Progress monitor interval tracking native parallel download progress
			let stopProgress = false;
			const progressInterval = safeInterval(
				this.unloads,
				async () => {
					if (stopProgress) return;
					const progress = await getNativeDownloadProgress(playbackInfo.trackId).catch(() => undefined);
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
				// True parallel native download
				await nativeDownloadTrack(playbackInfo, path, flacTags);
				stopProgress = true;
				progressInterval();

				// Verify integrity of newly downloaded file (FLAC header and STREAMINFO block)
				if (settings.verifyIntegrity) {
					track.statusText = "Verifying audio stream integrity...";
					this.notify();

					const integrity = await verifyAudioFileIntegrity(path);
					if (!integrity.isValid) {
						await deleteCorruptFile(path);
						throw new Error(`Corrupted file: ${integrity.error}`);
					}
				}

				// Ensure format info is populated on complete
				if (!track.formatInfo) {
					const finalFmt = await mediaItem.updateFormat(settings.downloadQuality).catch(() => undefined);
					if (finalFmt) {
						track.audioFormat = finalFmt;
						track.formatInfo = formatAudioDetails(finalFmt);
					}
				}

				// Download synchronized lyrics (.lrc) if enabled
				if (settings.saveLrcFile) {
					try {
						const lyrics = await mediaItem.lyrics().catch(() => undefined);
						const lyricsContent = lyrics?.subtitles || lyrics?.lyrics;
						if (lyricsContent) {
							await saveLyricsFile(path, lyricsContent);
						}
					} catch (lyricsErr) {
						trace.err.withContext("downloadSingleTrack.lyrics")(lyricsErr as Error);
					}
				}

				track.status = "completed";
				track.progressPercent = 100;
				track.statusText = track.formatInfo ? `Verified (${track.formatInfo})` : "Completed & Verified";
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
