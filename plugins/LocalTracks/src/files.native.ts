import { readFile, stat } from "fs/promises";

const MAX_SIZE = 1024 * 1024 * 1024;

/** Reads a local audio file so the renderer can play it through a Blob URL. */
export const readLocalFile = async (path: string): Promise<Uint8Array> => {
	const { size, isFile } = await stat(path).then((s) => ({ size: s.size, isFile: s.isFile() }));
	if (!isFile) throw new Error("Not a file");
	if (size > MAX_SIZE) throw new Error("File is larger than 1 GB");
	return new Uint8Array(await readFile(path));
};
