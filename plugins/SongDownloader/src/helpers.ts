import { MediaItem, type redux } from "@luna/lib";
import { showOpenDialog, showSaveDialog } from "@luna/lib.native";
import { settings } from "./Settings";

import sanitize from "sanitize-filename";

export const getDownloadFolder = async () => {
	const { canceled, filePaths } = await showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
	if (!canceled && filePaths?.[0]) return filePaths[0];
};

export const getDownloadPath = async (defaultPath: string) => {
	const { canceled, filePath } = await showSaveDialog({
		defaultPath,
		filters: [{ name: "", extensions: [defaultPath ?? "*"] }],
	});
	if (!canceled && filePath) return filePath;
};

export const getFileName = async (mediaItem: MediaItem, audioQuality?: redux.AudioQuality) => {
	const ext = (await mediaItem.fileExtension(audioQuality).catch(() => "flac")) || "flac";
	let format = settings.pathFormat || "{artist} - {album} - {title}";
	const { tags } = await mediaItem.flacTags();

	for (const tag of MediaItem.availableTags) {
		let tagValue = tags[tag];
		if (Array.isArray(tagValue)) tagValue = tagValue[0];
		if (tagValue === undefined) continue;
		format = format.replaceAll(`{${tag}}`, sanitize(String(tagValue)));
	}

	// Remove unreplaced placeholders
	format = format.replace(/\{[a-zA-Z0-9_]+\}/g, "").trim();

	// If empty after formatting, fallback to safe title
	if (!format) {
		format = sanitize(mediaItem.tidalItem.title || `Track-${mediaItem.id}`);
	}

	return `${format}.${ext}`;
};
