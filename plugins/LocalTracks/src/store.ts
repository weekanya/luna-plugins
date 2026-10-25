import { ReactiveStore } from "@luna/core";

export type LocalTrack = {
	id: string;
	kind: "file" | "url";
	/** Absolute file path or direct audio URL */
	source: string;
	title: string;
	artist: string;
};

type Storage = { playlists: Record<string, LocalTrack[]> };

const storage = await ReactiveStore.getPluginStorage<Storage>("LocalTracks", { playlists: {} });
if (!storage.playlists) storage.playlists = {};

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => {
	listeners.add(fn);
	return () => void listeners.delete(fn);
};

export const getTracks = (playlistId: string): LocalTrack[] => storage.playlists[playlistId] ?? [];

// Always reassign the whole map so the change is persisted.
const setTracks = (playlistId: string, tracks: LocalTrack[]) => {
	const next = { ...storage.playlists, [playlistId]: tracks };
	if (tracks.length === 0) delete next[playlistId];
	storage.playlists = next;
	listeners.forEach((fn) => fn());
};

export const addTrack = (playlistId: string, track: Omit<LocalTrack, "id">) =>
	setTracks(playlistId, [...getTracks(playlistId), { ...track, id: crypto.randomUUID() }]);

export const removeTrack = (playlistId: string, id: string) =>
	setTracks(
		playlistId,
		getTracks(playlistId).filter((t) => t.id !== id),
	);
