import { access, constants, mkdir, writeFile } from "fs/promises";
import { join, parse } from "path";

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
