export interface M3Palette {
	primary: [number, number, number];
	primaryContainer: [number, number, number];
	onPrimaryContainer: [number, number, number];
	surfaceContainer: [number, number, number];
}

const defaultPalette: M3Palette = {
	primary: [208, 188, 255],
	primaryContainer: [79, 55, 139],
	onPrimaryContainer: [234, 221, 255],
	surfaceContainer: [33, 31, 38],
};

let currentPalette: M3Palette = { ...defaultPalette };
let currentAnimFrame: number | null = null;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

const applyPaletteToElement = (palette: M3Palette) => {
	const root = document.documentElement;
	const modalRoot = document.getElementById("songdownloader-modal-root");

	const vars: Record<string, string> = {
		"--md-sys-color-primary": `rgb(${palette.primary.join(",")})`,
		"--md-sys-color-primary-container": `rgb(${palette.primaryContainer.join(",")})`,
		"--md-sys-color-on-primary-container": `rgb(${palette.onPrimaryContainer.join(",")})`,
		"--md-sys-color-surface-container": `rgb(${palette.surfaceContainer.join(",")})`,
	};

	for (const [key, val] of Object.entries(vars)) {
		root.style.setProperty(key, val);
		if (modalRoot) modalRoot.style.setProperty(key, val);
	}
};

export const animateToPalette = (targetPalette: M3Palette, duration = 600) => {
	if (currentAnimFrame !== null) {
		cancelAnimationFrame(currentAnimFrame);
		currentAnimFrame = null;
	}

	const startPalette: M3Palette = {
		primary: [...currentPalette.primary],
		primaryContainer: [...currentPalette.primaryContainer],
		onPrimaryContainer: [...currentPalette.onPrimaryContainer],
		surfaceContainer: [...currentPalette.surfaceContainer],
	};

	const startTime = performance.now();

	const frame = (now: number) => {
		const elapsed = now - startTime;
		const progress = Math.min(1, elapsed / duration);
		// MD3 Emphasized Decelerate Easing
		const t = 1 - Math.pow(1 - progress, 3);

		currentPalette = {
			primary: [
				lerp(startPalette.primary[0], targetPalette.primary[0], t),
				lerp(startPalette.primary[1], targetPalette.primary[1], t),
				lerp(startPalette.primary[2], targetPalette.primary[2], t),
			],
			primaryContainer: [
				lerp(startPalette.primaryContainer[0], targetPalette.primaryContainer[0], t),
				lerp(startPalette.primaryContainer[1], targetPalette.primaryContainer[1], t),
				lerp(startPalette.primaryContainer[2], targetPalette.primaryContainer[2], t),
			],
			onPrimaryContainer: [
				lerp(startPalette.onPrimaryContainer[0], targetPalette.onPrimaryContainer[0], t),
				lerp(startPalette.onPrimaryContainer[1], targetPalette.onPrimaryContainer[1], t),
				lerp(startPalette.onPrimaryContainer[2], targetPalette.onPrimaryContainer[2], t),
			],
			surfaceContainer: [
				lerp(startPalette.surfaceContainer[0], targetPalette.surfaceContainer[0], t),
				lerp(startPalette.surfaceContainer[1], targetPalette.surfaceContainer[1], t),
				lerp(startPalette.surfaceContainer[2], targetPalette.surfaceContainer[2], t),
			],
		};

		applyPaletteToElement(currentPalette);

		if (progress < 1) {
			currentAnimFrame = requestAnimationFrame(frame);
		} else {
			currentAnimFrame = null;
		}
	};

	currentAnimFrame = requestAnimationFrame(frame);
};

export const resetDynamicTheme = () => {
	animateToPalette(defaultPalette, 400);
};

/**
 * Extracts vibrant dominant color from cover image URL via Blob to avoid CORS taint in Electron
 */
export const extractPaletteFromCover = async (coverUrl: string): Promise<M3Palette | null> => {
	try {
		let blobUrl = coverUrl;
		let isBlobCreated = false;

		if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
			try {
				const response = await fetch(coverUrl);
				if (response.ok) {
					const blob = await response.blob();
					blobUrl = URL.createObjectURL(blob);
					isBlobCreated = true;
				}
			} catch (fetchErr) {
				console.warn("[SongDownloader:Theme] Direct blob fetch failed, falling back to img.src", fetchErr);
			}
		}

		return await new Promise<M3Palette | null>((resolve) => {
			const img = new Image();
			img.onload = () => {
				try {
					const canvas = document.createElement("canvas");
					canvas.width = 32;
					canvas.height = 32;
					const ctx = canvas.getContext("2d", { willReadFrequently: true });
					if (!ctx) {
						if (isBlobCreated) URL.revokeObjectURL(blobUrl);
						return resolve(null);
					}

					ctx.drawImage(img, 0, 0, 32, 32);
					const { data } = ctx.getImageData(0, 0, 32, 32);
					if (isBlobCreated) URL.revokeObjectURL(blobUrl);

					let bestR = 208;
					let bestG = 188;
					let bestB = 255;
					let maxScore = -1;

					for (let i = 0; i < data.length; i += 4) {
						const r = data[i];
						const g = data[i + 1];
						const b = data[i + 2];
						const a = data[i + 3];
						if (a < 128) continue;

						const max = Math.max(r, g, b);
						const min = Math.min(r, g, b);
						const l = (max + min) / 510;
						if (l < 0.12 || l > 0.88) continue; // skip pure black/white

						const s = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
						const score = s * 0.8 + (1 - Math.abs(l - 0.6)) * 0.2;

						if (score > maxScore) {
							maxScore = score;
							bestR = r;
							bestG = g;
							bestB = b;
						}
					}

					// Build harmonious MD3 dark theme tokens
					const primary: [number, number, number] = [
						Math.min(255, Math.max(160, Math.round(bestR * 1.15 + 15))),
						Math.min(255, Math.max(150, Math.round(bestG * 1.15 + 15))),
						Math.min(255, Math.max(170, Math.round(bestB * 1.15 + 15))),
					];

					const primaryContainer: [number, number, number] = [
						Math.round(bestR * 0.35 + 20),
						Math.round(bestG * 0.35 + 15),
						Math.round(bestB * 0.35 + 35),
					];

					const onPrimaryContainer: [number, number, number] = [
						Math.min(255, Math.round(bestR * 1.25 + 40)),
						Math.min(255, Math.round(bestG * 1.25 + 40)),
						Math.min(255, Math.round(bestB * 1.25 + 40)),
					];

					const surfaceContainer: [number, number, number] = [
						Math.round(26 + bestR * 0.05),
						Math.round(24 + bestG * 0.05),
						Math.round(30 + bestB * 0.05),
					];

					resolve({ primary, primaryContainer, onPrimaryContainer, surfaceContainer });
				} catch (err) {
					if (isBlobCreated) URL.revokeObjectURL(blobUrl);
					resolve(null);
				}
			};
			img.onerror = () => {
				if (isBlobCreated) URL.revokeObjectURL(blobUrl);
				resolve(null);
			};
			img.src = blobUrl;
		});
	} catch (e) {
		console.warn("[SongDownloader:Theme] Error extracting palette", e);
		return null;
	}
};
