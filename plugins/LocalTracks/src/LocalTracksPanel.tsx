import { showOpenDialog } from "@luna/lib.native";
import React, { useEffect, useState } from "react";
import { dropFromQueue, getPlayerState, playLocal, subscribePlayer } from "./player";
import { addTrack, getTracks, removeTrack, subscribe, type LocalTrack } from "./store";

const AUDIO_EXTENSIONS = ["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "wma", "aiff"];

const baseName = (s: string) => decodeURIComponent(s.split(/[\\/]/).pop()?.split("?")[0] ?? s).replace(/\.[^.]+$/, "");
const splitName = (name: string) => {
	const [artist, ...rest] = name.split(" - ");
	return rest.length > 0 ? { artist: artist.trim(), title: rest.join(" - ").trim() } : { artist: "", title: name.trim() };
};

/** Local tracks of one playlist, shown inline on the playlist page. */
export const LocalTracksPanel = ({ playlistId }: { playlistId: string }) => {
	const [tracks, setTracks] = useState(() => getTracks(playlistId));
	const [player, setPlayer] = useState(getPlayerState);
	const [link, setLink] = useState("");
	const [showLink, setShowLink] = useState(false);
	const [error, setError] = useState<string>();

	useEffect(() => {
		setTracks(getTracks(playlistId));
		return subscribe(() => setTracks(getTracks(playlistId)));
	}, [playlistId]);
	useEffect(() => subscribePlayer(setPlayer), []);

	const pickFiles = async () => {
		setError(undefined);
		const { canceled, filePaths } = await showOpenDialog({
			properties: ["openFile", "multiSelections"],
			filters: [{ name: "Audio", extensions: AUDIO_EXTENSIONS }],
		});
		if (canceled) return;
		for (const path of filePaths ?? []) addTrack(playlistId, { kind: "file", source: path, ...splitName(baseName(path)) });
	};

	const addLink = async () => {
		setError(undefined);
		let text = link.trim();
		if (!text) text = (await navigator.clipboard.readText().catch(() => "")).trim();
		let url: URL;
		try {
			url = new URL(text);
		} catch {
			return setError("Paste a direct link to an audio file (https://…)");
		}
		if (!/^https?:$/.test(url.protocol)) return setError("Only http(s) links are supported");
		addTrack(playlistId, { kind: "url", source: url.href, ...splitName(baseName(url.pathname) || url.hostname) });
		setLink("");
		setShowLink(false);
	};

	return (
		<section className="lt-inline">
			<div className="lt-header">
				<h3>Local tracks{tracks.length > 0 ? ` · ${tracks.length}` : ""}</h3>
				<div className="lt-actions">
					{tracks.length > 0 && (
						<button className="lt-btn lt-btn-tonal" onClick={() => playLocal(tracks[0], tracks)}>
							▶ Play all
						</button>
					)}
					<button className="lt-btn lt-btn-filled" onClick={pickFiles}>＋ File</button>
					<button className="lt-btn lt-btn-tonal" onClick={() => setShowLink((v) => !v)}>＋ Link</button>
				</div>
			</div>
			{showLink && (
				<div className="lt-link-row">
					<input
						className="lt-input"
						autoFocus
						placeholder="Direct link to audio (empty = paste from clipboard)"
						value={link}
						onChange={(e) => setLink(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && addLink()}
					/>
					<button className="lt-btn lt-btn-filled" onClick={addLink}>Add</button>
				</div>
			)}
			{(error ?? player.error) && <div className="lt-error">{error ?? player.error}</div>}
			<ul className="lt-list">
				{tracks.length === 0 && <li className="lt-empty">Track missing on Tidal? Add it from a file or link — stored on this device only.</li>}
				{tracks.map((t) => (
					<TrackRow
						key={t.id}
						track={t}
						active={player.track?.id === t.id}
						playing={player.playing && player.track?.id === t.id}
						onPlay={() => playLocal(t, tracks)}
						onRemove={() => {
							dropFromQueue(t.id);
							removeTrack(playlistId, t.id);
						}}
					/>
				))}
			</ul>
		</section>
	);
};

const TrackRow = ({ track, active, playing, onPlay, onRemove }: { track: LocalTrack; active: boolean; playing: boolean; onPlay: () => void; onRemove: () => void }) => (
	<li className={"lt-row" + (active ? " lt-row-active" : "")} onDoubleClick={onPlay}>
		<button className="lt-icon-btn lt-play" onClick={onPlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
		<div className="lt-meta">
			<div className="lt-title">{track.title}</div>
			<div className="lt-sub">
				{track.artist ? `${track.artist} · ` : ""}
				{track.kind === "file" ? "Local file" : "Link"}
			</div>
		</div>
		<button className="lt-icon-btn" aria-label="Remove" onClick={onRemove}>🗑</button>
	</li>
);
