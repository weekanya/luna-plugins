import { Tracer, type LunaUnload } from "@luna/core";
import { StyleTag } from "@luna/lib";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { LocalTracksPanel } from "./LocalTracksPanel";
import { MiniPlayer } from "./MiniPlayer";
import { stopLocal, watchTidalPlayback } from "./player";

import styles from "file://localTracks.css?minify";

export const { errSignal, trace } = Tracer("[LocalTracks]");
export const unloads = new Set<LunaUnload>();

new StyleTag("LocalTracks", unloads, styles);

const PLAYLIST_ROUTE = /\/playlist\/([0-9a-f-]{36})/i;
const getPlaylistId = () => PLAYLIST_ROUTE.exec(location.pathname + location.hash)?.[1];

// Tidal's track rows; the local section is mounted right after the list they live in.
const ROW_SELECTOR = `[data-test="tracklist-row"], [data-track-id]`;
const SLOT_ID = "localtracks-slot";

const usePlaylistId = () => {
	const [id, setId] = useState(getPlaylistId);
	useEffect(() => {
		const update = () => setId(getPlaylistId());
		const timer = setInterval(update, 500);
		window.addEventListener("popstate", update);
		return () => {
			clearInterval(timer);
			window.removeEventListener("popstate", update);
		};
	}, []);
	return id;
};

/** Mounts the local tracks section under Tidal's track list (floating fallback), re-mounting as the SPA re-renders. */
const useSlot = (playlistId?: string) => {
	useEffect(() => {
		if (!playlistId) return;
		const el = document.createElement("div");
		el.id = SLOT_ID;
		const slotRoot = createRoot(el);
		slotRoot.render(<LocalTracksPanel playlistId={playlistId} />);
		const place = () => {
			const row = document.querySelector(ROW_SELECTOR);
			// The row's parent is the list; its parent is the container to append to.
			const host = row?.parentElement?.parentElement ?? row?.parentElement;
			el.classList.toggle("lt-floating", !host);
			const target = host ?? document.body;
			if (el.parentElement !== target) target.appendChild(el);
		};
		place();
		const mo = new MutationObserver(place);
		mo.observe(document.body, { childList: true, subtree: true });
		return () => {
			mo.disconnect();
			slotRoot.unmount();
			el.remove();
		};
	}, [playlistId]);
};

const App = () => {
	useSlot(usePlaylistId());
	return <MiniPlayer />;
};

const container = document.createElement("div");
container.id = "localtracks-root";
document.body.appendChild(container);
const root = createRoot(container);
root.render(<App />);

watchTidalPlayback(unloads);
unloads.add(() => {
	stopLocal();
	root.unmount();
	container.remove();
});
