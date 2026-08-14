import { PlayState, Quality, type MediaItem } from "@luna/lib";

import { unloads } from "./index.safe";

import type { LunaUnload } from "@luna/core";

let formatUnload: LunaUnload | undefined;
export const setFormatInfo = async (mediaItem?: MediaItem) => {
	if (mediaItem === undefined) return;

	const qualityContainer = document.querySelector<HTMLElement>(`[class*="_qualityBadgeContainer"]`);
	if (qualityContainer == null) throw new Error("Failed to find tidal _utilityContainer element!");

	const qualityText = qualityContainer.querySelector<HTMLSpanElement>("span > span");
	if (qualityText === null) throw new Error("Failed to find _utilityContainer.[span > span] qualityText element");

	const progressBar = <HTMLElement>document.getElementById("progressBar");
	if (progressBar === null) throw new Error("Failed to find tidal progressBar element!");

	qualityContainer.style.textAlign = "center";
	qualityText.textContent = `Loading...`;

	if (mediaItem.id != PlayState.playbackContext.actualProductId) return;
	const audioQuality = PlayState.playbackContext.actualAudioQuality;

	progressBar.style.color = qualityContainer.style.color = Quality.fromAudioQuality(audioQuality)?.color ?? "#cfcfcf";

	formatUnload?.();
	formatUnload = mediaItem.withFormat(unloads, audioQuality, ({ sampleRate, bitDepth, bitrate }) => {
		qualityText.textContent = "";
		if (!!bitDepth) qualityText.textContent += `${bitDepth}-bit `;
		if (!!sampleRate) qualityText.textContent += `${sampleRate / 1000}kHz `;
		if (!!bitrate) qualityText.textContent += `${Math.floor(bitrate / 1000).toLocaleString()}kb/s`;
		if (qualityText.textContent === "") qualityText.textContent = "Unknown";
	});

	try {
		await mediaItem.updateFormat(audioQuality);
	} catch (err) {
		qualityContainer.style.border = "solid 1px red";
		const errorText = (<Error>err).message.substring(0, 64);
		qualityText.textContent = errorText;
		throw err;
	}
};
