import { ReactiveStore } from "@luna/core";
import { MediaItem, Quality, type redux } from "@luna/lib";
import { LunaButtonSetting, LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting, LunaTextSetting } from "@luna/ui";

import React, { useEffect } from "react";
import { downloadManager } from "./downloadManager";
import { getDownloadFolder } from "./helpers";

const defaultFilenameFormat = "{artist} - {album} - {title}";

export type Settings = {
	downloadQuality: redux.AudioQuality;
	defaultPath?: string;
	pathFormat: string;
	useRealMAX: boolean;
	concurrentDownloads: number;
	skipExisting: boolean;
	saveLrcFile: boolean;
	dynamicTheme: boolean;
	verifyIntegrity: boolean;
};

export const settings = await ReactiveStore.getPluginStorage<Settings>("SongDownloader", {
	downloadQuality: Quality.Max.audioQuality,
	pathFormat: defaultFilenameFormat,
	useRealMAX: true,
	concurrentDownloads: 2,
	skipExisting: true,
	saveLrcFile: true,
	dynamicTheme: true,
	verifyIntegrity: true,
});

// Sanitize and ensure persistent defaults
if (Quality.fromAudioQuality(settings.downloadQuality) === undefined) settings.downloadQuality = Quality.Max.audioQuality;
if (settings.concurrentDownloads === undefined || settings.concurrentDownloads < 1) settings.concurrentDownloads = 2;
if (settings.skipExisting === undefined) settings.skipExisting = true;
if (settings.saveLrcFile === undefined) settings.saveLrcFile = true;
if (settings.dynamicTheme === undefined) settings.dynamicTheme = true;
if (settings.useRealMAX === undefined) settings.useRealMAX = true;
if (settings.verifyIntegrity === undefined) settings.verifyIntegrity = true;

export const Settings = () => {
	const [downloadQuality, setDownloadQuality] = React.useState(settings.downloadQuality);
	const [defaultPath, setDefaultPath] = React.useState(settings.defaultPath);
	const [pathFormat, setPathFormat] = React.useState(settings.pathFormat);
	const [useRealMAX, setUseRealMAX] = React.useState(settings.useRealMAX ?? true);
	const [concurrentDownloads, setConcurrentDownloads] = React.useState(settings.concurrentDownloads ?? 2);
	const [skipExisting, setSkipExisting] = React.useState(settings.skipExisting ?? true);
	const [saveLrcFile, setSaveLrcFile] = React.useState(settings.saveLrcFile ?? true);
	const [dynamicTheme, setDynamicTheme] = React.useState(settings.dynamicTheme ?? true);
	const [verifyIntegrity, setVerifyIntegrity] = React.useState(settings.verifyIntegrity ?? true);

	// Sync state bidirectionally with DownloadManager
	useEffect(() => {
		return downloadManager.subscribe((state) => {
			setUseRealMAX(state.useRealMAX);
			setConcurrentDownloads(state.concurrentDownloads);
			setDynamicTheme(state.dynamicTheme);
		});
	}, []);

	return (
		<LunaSettings>
			<LunaButtonSetting
				title="Download Manager"
				desc="Open the active download queue window to see downloads, progress, and errors"
				children="Open Download Manager"
				onClick={() => downloadManager.openModal()}
			/>
			<LunaSelectSetting
				title="Download quality"
				value={downloadQuality}
				onChange={(e: any) => setDownloadQuality((settings.downloadQuality = e.target.value))}
			>
				{Object.values(Quality.lookups.audioQuality).map((quality) => {
					if (typeof quality !== "string" && quality.audioQuality !== Quality.MQA.audioQuality)
						return <LunaSelectItem key={quality.name} value={quality.audioQuality} children={quality.name} />;
				})}
			</LunaSelectSetting>
			<LunaSelectSetting
				title="Concurrent downloads"
				desc="Number of tracks to download simultaneously in parallel"
				value={String(concurrentDownloads)}
				onChange={(e: any) => {
					const val = Number(e.target.value) || 2;
					downloadManager.setConcurrentDownloads(val);
					setConcurrentDownloads(val);
				}}
			>
				<LunaSelectItem value="1" children="1 track (Sequential)" />
				<LunaSelectItem value="2" children="2 tracks (Recommended)" />
				<LunaSelectItem value="3" children="3 tracks (Fast)" />
				<LunaSelectItem value="4" children="4 tracks (Maximum)" />
			</LunaSelectSetting>
			<LunaSwitchSetting
				title="Use RealMAX to find the highest quality"
				checked={useRealMAX}
				onChange={(_: any, checked: boolean) => {
					downloadManager.setRealMAX(checked);
					setUseRealMAX(checked);
				}}
			/>
			<LunaSwitchSetting
				title="Verify file integrity (Check corrupted/broken files)"
				desc="Inspects FLAC headers and STREAMINFO blocks to guarantee uncorrupted audio. Auto-replaces corrupted files."
				checked={verifyIntegrity}
				onChange={(_: any, checked: boolean) => {
					settings.verifyIntegrity = checked;
					setVerifyIntegrity(checked);
					downloadManager.notifySettingsChanged();
				}}
			/>
			<LunaSwitchSetting
				title="Skip already downloaded tracks"
				desc="Automatically checks if a valid file already exists on disk and skips re-downloading"
				checked={skipExisting}
				onChange={(_: any, checked: boolean) => {
					settings.skipExisting = checked;
					setSkipExisting(checked);
					downloadManager.notifySettingsChanged();
				}}
			/>
			<LunaSwitchSetting
				title="Save synchronized lyrics (.lrc)"
				desc="Downloads timed .lrc lyrics file alongside the track for offline players"
				checked={saveLrcFile}
				onChange={(_: any, checked: boolean) => {
					settings.saveLrcFile = checked;
					setSaveLrcFile(checked);
					downloadManager.notifySettingsChanged();
				}}
			/>
			<LunaSwitchSetting
				title="Dynamic Material You Theme"
				desc="Smoothly transitions Download Manager colors to match the currently downloading album art"
				checked={dynamicTheme}
				onChange={(_: any, checked: boolean) => {
					settings.dynamicTheme = checked;
					setDynamicTheme(checked);
					downloadManager.setDynamicTheme(checked);
				}}
			/>
			<LunaButtonSetting
				title="Default save path"
				desc={
					<>
						Set a default folder to save files to (will disable prompting for path on download)
						{defaultPath && (
							<>
								<br />
								Using {defaultPath}
							</>
						)}
					</>
				}
				children={defaultPath === undefined ? "Set default folder" : "Clear default folder"}
				onClick={async () => {
					if (defaultPath !== undefined) return setDefaultPath((settings.defaultPath = undefined));
					setDefaultPath((settings.defaultPath = await getDownloadFolder()));
				}}
			/>
			<LunaTextSetting
				title="Path format"
				desc={
					<>
						Define subfolders using <b>/</b>.
						<br />
						For example: {"{artist}/{album}/{title}"}
						<br />
						Saves in subfolder artist/album/ named <b>title.flac</b>.
						<div style={{ marginTop: 8 }} />
						You can use the following tags:
						<ul>
							{MediaItem.availableTags.map((tag) => (
								<li key={tag}>{tag}</li>
							))}
						</ul>
					</>
				}
				value={pathFormat}
				onChange={(e: any) => setPathFormat((settings.pathFormat = e.target.value))}
			/>
		</LunaSettings>
	);
};
