import sanitize from "sanitize-filename";
import { createWriteStream, type Writable } from "fs";
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

		if (!fileStat || fileStat.size < 128) {
			return { isValid: false, error: "File is empty or truncated (< 128 bytes)", size: fileStat?.size };
		}

		const fileHandle = await open(filePath, "r");
		const buffer = Buffer.alloc(64);
		await fileHandle.read(buffer, 0, 64, 0);
		await fileHandle.close();

		// 1. Check for FLAC ("fLaC" magic signature: 0x66, 0x4c, 0x61, 0x43)
		if (buffer[0] === 0x66 && buffer[1] === 0x4c && buffer[2] === 0x61 && buffer[3] === 0x43) {
			const blockHeader = buffer[4];
			const blockType = blockHeader & 0x7f;
			if (blockType !== 0) {
				return { isValid: false, error: "Missing STREAMINFO block in FLAC header", format: "flac" };
			}
			const blockLength = (buffer[5] << 16) | (buffer[6] << 8) | buffer[7];
			if (blockLength !== 34 || fileStat.size < 8 + blockLength) {
				return { isValid: false, error: "Invalid FLAC STREAMINFO header length", format: "flac" };
			}
			return { isValid: true, format: "flac", size: fileStat.size };
		}

		// 2. Check for M4A / MP4 ("ftyp" atom at offset 4)
		const ftyp = buffer.toString("ascii", 4, 8);
		if (ftyp === "ftyp") {
			const atomSize = buffer.readUInt32BE(0);
			if (atomSize !== 0 && atomSize < 8) return { isValid: false, error: "Invalid MP4 atom size", format: "m4a" };
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

export const saveTextFile = async (
	folderPath: string | undefined,
	fileName: string,
	content: string,
): Promise<string | undefined> => {
	try {
		const targetDir = folderPath || process.env.HOME || "/tmp";
		await mkdir(targetDir, { recursive: true });
		const cleanName = sanitize(fileName) || "export.txt";
		const fullPath = join(targetDir, cleanName);
		await writeFile(fullPath, content, "utf8");
		return fullPath;
	} catch (e) {
		console.error("Failed to save text file", e);
		return undefined;
	}
};

type ActiveDownload = { progress: FetchProgress; promise: Promise<void>; reject: (reason?: unknown) => void; stream?: any; writeStream?: Writable; targetPath: string; settled: boolean };
const activeDownloads: Record<string | number, ActiveDownload | undefined> = {};

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
	if (Array.isArray(path)) path = join(...path);
	const parsedPath = parse(path);
	await mkdir(parsedPath.dir, { recursive: true });
	const targetPath = join(parsedPath.dir, sanitize(parsedPath.base));
	const writeStream = createWriteStream(targetPath);
	const progress: FetchProgress = { total: 0, downloaded: 0 };
	const { resolve, reject, promise } = Promise.withResolvers<void>();
	const entry: ActiveDownload = { progress, promise, reject, writeStream, targetPath, settled: false };
	activeDownloads[trackId] = entry;

	const fail = (error: unknown) => {
		if (entry.settled) return;
		entry.settled = true;
		try { writeStream.destroy(); } catch {}
		reject(error instanceof Error ? error : new Error(String(error)));
	};
	writeStream.once("finish", () => {
		if (!entry.settled) { entry.settled = true; resolve(); }
	});
	writeStream.once("error", fail);

	try {
		const stream = await fetchMediaItemStream(playbackInfo, { progress, tags });
		entry.stream = stream;
		stream.once?.("error", fail);
		stream.pipe(writeStream);
		await promise;
	} catch (error) {
		fail(error);
		await promise.catch(() => undefined);
		await unlink(targetPath).catch(() => undefined);
		throw error;
	} finally {
		delete activeDownloads[trackId];
	}
};

/** Abort a native download and remove its partial output. */
export const cancelNativeDownload = async (trackId: string | number): Promise<void> => {
	const entry = activeDownloads[trackId];
	if (!entry) return;
	try { entry.stream?.destroy?.(new Error("Download cancelled")); } catch {}
	try { entry.writeStream?.destroy?.(new Error("Download cancelled")); } catch {}
	if (!entry.settled) {
		entry.settled = true;
		entry.reject(new Error("Download cancelled"));
	}
	await unlink(entry.targetPath).catch(() => undefined);
};
