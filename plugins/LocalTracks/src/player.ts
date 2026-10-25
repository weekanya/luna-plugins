import type { LunaUnloads } from "@luna/core";
import { PlayState } from "@luna/lib";
import { readLocalFile } from "./files.native";
import type { LocalTrack } from "./store";

export type PlayerState = {
	track?: LocalTrack;
	queue: LocalTrack[];
	playing: boolean;
	time: number;
	duration: number;
	error?: string;
};

const audio = new Audio();
let blobUrl: string | undefined;
let state: PlayerState = { queue: [], playing: false, time: 0, duration: 0 };
const listeners = new Set<(s: PlayerState) => void>();

const set = (patch: Partial<PlayerState>) => {
	state = { ...state, ...patch };
	listeners.forEach((fn) => fn(state));
};
const revoke = () => {
	if (blobUrl) URL.revokeObjectURL(blobUrl);
	blobUrl = undefined;
};

audio.addEventListener("play", () => set({ playing: true }));
audio.addEventListener("pause", () => set({ playing: false }));
audio.addEventListener("timeupdate", () => set({ time: audio.currentTime }));
audio.addEventListener("durationchange", () => set({ duration: isFinite(audio.duration) ? audio.duration : 0 }));
audio.addEventListener("ended", () => {
	if (!nextLocal()) set({ playing: false });
});
audio.addEventListener("error", () => set({ playing: false, error: "Cannot play this source (unsupported format or not a direct audio link)" }));

export const subscribePlayer = (fn: (s: PlayerState) => void) => {
	listeners.add(fn);
	return () => void listeners.delete(fn);
};
export const getPlayerState = () => state;

const load = async (track: LocalTrack, queue: LocalTrack[]) => {
	audio.pause();
	revoke();
	set({ track, queue, playing: false, time: 0, duration: 0, error: undefined });
	try {
		if (track.kind === "file") {
			blobUrl = URL.createObjectURL(new Blob([(await readLocalFile(track.source)) as BlobPart]));
			audio.src = blobUrl;
		} else audio.src = track.source;
		// Don't play two things at once
		await PlayState.pause();
		await audio.play();
	} catch (e) {
		set({ playing: false, error: e instanceof Error ? e.message : String(e) });
	}
};

/** Play a track; the rest of `queue` plays after it automatically. Toggles pause if it is already current. */
export const playLocal = async (track: LocalTrack, queue: LocalTrack[] = [track]) => {
	if (state.track?.id === track.id && audio.src) {
		if (audio.paused) {
			await PlayState.pause();
			await audio.play();
		} else audio.pause();
		return;
	}
	await load(track, queue);
};

const step = (dir: 1 | -1) => {
	const i = state.queue.findIndex((t) => t.id === state.track?.id);
	const target = state.queue[i + dir];
	if (!target) return false;
	void load(target, state.queue);
	return true;
};
export const nextLocal = () => step(1);
export const prevLocal = () => {
	if (audio.currentTime > 3) return void (audio.currentTime = 0);
	step(-1);
};
export const seekLocal = (time: number) => void (audio.currentTime = time);
export const togglePlayLocal = () => (state.track ? playLocal(state.track, state.queue) : undefined);

export const stopLocal = () => {
	audio.pause();
	audio.removeAttribute("src");
	revoke();
	set({ track: undefined, queue: [], playing: false, time: 0, duration: 0, error: undefined });
};

/** Local track is dropped from the player if it is removed from its playlist. */
export const dropFromQueue = (id: string) => {
	if (state.track?.id === id) stopLocal();
	else set({ queue: state.queue.filter((t) => t.id !== id) });
};

// Pause local audio as soon as Tidal starts playing
export const watchTidalPlayback = (unloads: LunaUnloads) =>
	PlayState.onState(unloads, (s) => {
		if (s === "PLAYING" && !audio.paused) audio.pause();
	});
