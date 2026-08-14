import { Tracer, type LunaUnload } from "@luna/core";
import { ContextMenu, StyleTag } from "@luna/lib";
import React from "react";
import { createRoot } from "react-dom/client";

import { downloadManager } from "./downloadManager";
import { DownloadModal } from "./DownloadModal";
import { saveTextFile } from "./fileUtils.native";
import { settings } from "./Settings";

import buttonStyles from "file://downloadButton.css?minify";
import modalStyles from "file://downloadModal.css?minify";

export const { errSignal, trace } = Tracer("[SongDownloader]");
export const unloads = new Set<LunaUnload>();

new StyleTag("SongDownloaderButton", unloads, buttonStyles);
new StyleTag("SongDownloaderModal", unloads, modalStyles);

// Mount the Download Manager UI into the DOM
const modalContainer = document.createElement("div");
modalContainer.id = "songdownloader-modal-root";
document.body.appendChild(modalContainer);
const reactRoot = createRoot(modalContainer);
reactRoot.render(<DownloadModal />);

unloads.add(() => {
	reactRoot.unmount();
	modalContainer.remove();
});
unloads.add(() => downloadManager.unloads.forEach((u) => u()));

export { Settings } from "./Settings";

// Download & Export buttons in Media Item context menu
const downloadButton = ContextMenu.addButton(unloads);
const exportButton = ContextMenu.addButton(unloads);

ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
	const trackCount = await mediaCollection.count().catch(() => 0);
	if (trackCount === 0) return;

	// 1. Download Action
	downloadButton.text = trackCount > 1 ? `Download ${trackCount} tracks` : "Download track";
	downloadButton.onClick(async () => {
		await downloadManager.startDownload(mediaCollection);
	});
	await downloadButton.show(contextMenu);

	// 2. Export Tracklist Action
	exportButton.text = "Export tracklist (.txt)";
	exportButton.onClick(async () => {
		const rawTitle = (await mediaCollection.title().catch(() => undefined)) || "Playlist";
		const items: string[] = [];
		let index = 1;

		for await (const item of await mediaCollection.mediaItems()) {
			const tTitle = item.tidalItem.title ?? "Unknown Title";
			const artist =
				item.tidalItem.artists?.map((a) => a.name).join(", ") ?? item.tidalItem.artist?.name ?? "Unknown Artist";
			const album = item.tidalItem.album?.title ? ` - ${item.tidalItem.album.title}` : "";
			items.push(`${index++}. ${artist}${album} - ${tTitle}`);
		}

		const content = [
			`=======================================================`,
			`🎵 ${rawTitle.toUpperCase()}`,
			`📊 Всего треков: ${items.length}`,
			`📅 Дата экспорта: ${new Date().toLocaleString()}`,
			`=======================================================`,
			"",
			...items,
		].join("\n");

		try {
			if (navigator?.clipboard) {
				await navigator.clipboard.writeText(content);
			}
		} catch (_) {}

		const cleanTitle = rawTitle.replace(/[^\w\s-]/g, "").trim() || "Tracklist";
		const fileName = `${cleanTitle}.txt`;
		const saveDir = settings.defaultPath;
		await saveTextFile(saveDir, fileName, content);
	});
	await exportButton.show(contextMenu);
});

// Shortcut button to open Download Manager anytime from user profile context menu
const managerButton = ContextMenu.addButton(unloads);
managerButton.text = "Download Manager";
managerButton.onClick(() => downloadManager.openModal());

ContextMenu.onOpen(unloads, async ({ event, contextMenu }) => {
	if (event.type === "USER_PROFILE") {
		const elem = await managerButton.show(contextMenu);
		if (elem) elem.style.color = "#9e46ff";
	}
});
