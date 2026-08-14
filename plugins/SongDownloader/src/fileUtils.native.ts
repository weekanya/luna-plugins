import sanitize from "sanitize-filename";
import { createWriteStream } from "fs";
import { access, constants, mkdir, open, stat, unlink, writeFile } from "fs/promises";
import { join, parse } from "path";
import { fetchMediaItemStream, type FetchProgress } from "@luna/lib.native";

export interface FileIntegrityResult {
	isValid: boolean;
	error?: string;
	size?: number;
	format?: "flac" | "m4a" | "unknown";
}

export const fileExists = async (path: string | string[]): Promise<boolean> => {
	try {
		const filePath = Array.isArray(path) ? join(...path) : path;
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
};

export const deleteCorruptFile = async (path: string | string[]): Promise<boolean> => {
	try {
		const filePath = Array.isArray(path) ? join(...path) : path;
		await unlink(filePath);
		return true;
	} catch {
		return false;
	}
};

/**
 * Validates that an audio file is not 0-byte, truncated, or broken.
 * Checks FLAC "fLaC" magic bytes and STREAMINFO header, or MP4/M4A "ftyp" atoms.
 */
export const verifyAudioFileIntegrity = async (path: string | string[]): Promise<FileIntegrityResult> => {
	try {
		const filePath = Array.isArray(path) ? join(...path) : path;
		const fileStat = await stat(filePath).catch(() => null);

		if (!fileStat || fileStat.size < 4096) {
			return { isValid: false, error: "File is empty or truncated (< 4 KB)", size: fileStat?.size };
		}

		const fileHandle = await open(filePath, "r");
		const buffer = Buffer.alloc(64);
		await fileHandle.read(buffer, 0, 64, 0);
		await fileHandle.close();

		// 1. Check for FLAC ("fLaC" magic signature: 0x66, 0x4c, 0x61, 0x43)
		if (buffer[0] === 0x66 && buffer[1] === 0x4c && buffer[2] === 0x61 && buffer[3] === 0x43) {
			// Check first metadata block header (must be STREAMINFO = type 0)
			const blockHeader = buffer[4];
			const blockType = blockHeader & 0x7f;
			if (blockType !== 0) {
				return { isValid: false, error: "Missing STREAMINFO block in FLAC header", format: "flac" };
			}
			const blockLength = (buffer[5] << 16) | (buffer[6] << 8) | buffer[7];
			if (blockLength !== 34) {
				return { isValid: false, error: "Invalid FLAC STREAMINFO header length", format: "flac" };
			}
			return { isValid: true, format: "flac", size: fileStat.size };
		}

		// 2. Check for M4A / MP4 ("ftyp" atom at offset 4)
		const ftyp = buffer.toString("ascii", 4, 8);
		if (ftyp === "ftyp") {
			return { isValid: true, format: "m4a", size: fileStat.size };
		}

		return { isValid: false, error: "Invalid audio header (corrupted stream)", format: "unknown" };
	} catch (err) {
		return { isValid: false, error: (err as Error)?.message || "Failed to verify audio integrity" };
	}
};

export const saveLyricsFile = async (audioPath: string | string[], lyricsContent: string): Promise<boolean> => {
	try {
		const filePath = Array.isArray(audioPath) ? join(...audioPath) : audioPath;
		const parsed = parse(filePath);
		const lrcPath = join(parsed.dir, `${parsed.name}.lrc`);
		await mkdir(parsed.dir, { recursive: true });
		await writeFile(lrcPath, lyricsContent, "utf8");
		return true;
	} catch (e) {
		console.error("Failed to save lyrics file", e);
		return false;
	}
};

const activeDownloads: Record<string | number, { progress: FetchProgress; promise: Promise<void> } | undefined> = {};

export const getNativeDownloadProgress = async (trackId: string | number): Promise<FetchProgress | undefined> => {
	return activeDownloads[trackId]?.progress;
};

export const nativeDownloadTrack = async (
	playbackInfo: any,
	path: string | string[],
	tags?: any,
): Promise<void> => {
	const trackId = playbackInfo.trackId;
	if (activeDownloads[trackId] !== undefined) return activeDownloads[trackId]!.promise;

	try {
		if (Array.isArray(path)) path = join(...path);
		const parsedPath = parse(path);
		await mkdir(parsedPath.dir, { recursive: true });
		const writeStream = createWriteStream(join(parsedPath.dir, sanitize(parsedPath.base)));

		const progress: FetchProgress = { total: 0, downloaded: 0 };
		const stream = await fetchMediaItemStream(playbackInfo, {
			progress,
			tags,
		});

		const { resolve, reject, promise } = Promise.withResolvers<void>();
		activeDownloads[trackId] = { progress, promise };

		stream.pipe(writeStream).on("finish", resolve).on("error", reject);

		await promise;
	} finally {
		delete activeDownloads[trackId];
	}
};
