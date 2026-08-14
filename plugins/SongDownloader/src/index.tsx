import { Tracer, type LunaUnload } from "@luna/core";
import { ContextMenu, StyleTag } from "@luna/lib";
import React from "react";
import { createRoot } from "react-dom/client";

import { downloadManager } from "./downloadManager";
import { DownloadModal } from "./DownloadModal";

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

// Download button in Media Item context menu
const downloadButton = ContextMenu.addButton(unloads);

ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
	const trackCount = await mediaCollection.count().catch(() => 0);
	if (trackCount === 0) return;

	downloadButton.text = trackCount > 1 ? `Download ${trackCount} tracks` : "Download track";
	downloadButton.onClick(async () => {
		await downloadManager.startDownload(mediaCollection);
	});

	await downloadButton.show(contextMenu);
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
