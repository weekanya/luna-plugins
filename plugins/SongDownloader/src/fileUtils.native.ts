import sanitize from "sanitize-filename";
import { createWriteStream } from "fs";
import { access, constants, mkdir, writeFile } from "fs/promises";
import { join, parse } from "path";
import { fetchMediaItemStream, type FetchProgress } from "@luna/lib.native";

export const fileExists = async (path: string | string[]): Promise<boolean> => {
	try {
		const filePath = Array.isArray(path) ? join(...path) : path;
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
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
