import React, { useEffect, useState } from "react";
import { getPlayerState, nextLocal, prevLocal, seekLocal, stopLocal, subscribePlayer, togglePlayLocal } from "./player";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const MiniPlayer = () => {
	const [p, setP] = useState(getPlayerState);
	useEffect(() => subscribePlayer(setP), []);
	if (!p.track) return null;
	return (
		<div className="lt-mini">
			<div className="lt-mini-meta">
				<div className="lt-title">{p.track.title}</div>
				<div className="lt-sub">{p.error ?? (p.track.artist || "Local track")}</div>
			</div>
			<button className="lt-icon-btn" onClick={prevLocal} aria-label="Previous">⏮</button>
			<button className="lt-icon-btn lt-play" onClick={togglePlayLocal} aria-label="Play/Pause">{p.playing ? "❚❚" : "▶"}</button>
			<button className="lt-icon-btn" onClick={() => nextLocal()} aria-label="Next">⏭</button>
			<span className="lt-time">{fmt(p.time)}</span>
			<input className="lt-seek" type="range" min={0} max={p.duration || 0} step={1} value={p.time} onChange={(e) => seekLocal(Number(e.target.value))} />
			<span className="lt-time">{fmt(p.duration)}</span>
			<button className="lt-icon-btn" onClick={stopLocal} aria-label="Close">✕</button>
		</div>
	);
};
