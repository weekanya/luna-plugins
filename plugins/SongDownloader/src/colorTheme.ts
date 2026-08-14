export interface M3Palette {
	primary: [number, number, number];
	primaryContainer: [number, number, number];
	onPrimaryContainer: [number, number, number];
}

const defaultPalette: M3Palette = {
	primary: [208, 188, 255],
	primaryContainer: [79, 55, 139],
	onPrimaryContainer: [234, 221, 255],
};

let currentPalette: M3Palette = { ...defaultPalette };
let currentAnimFrame: number | null = null;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

const applyPaletteToElement = (palette: M3Palette) => {
	const root = document.getElementById("songdownloader-modal-root") || document.documentElement;
	root.style.setProperty("--md-sys-color-primary", `rgb(${palette.primary.join(",")})`);
	root.style.setProperty("--md-sys-color-primary-container", `rgb(${palette.primaryContainer.join(",")})`);
	root.style.setProperty("--md-sys-color-on-primary-container", `rgb(${palette.onPrimaryContainer.join(",")})`);
};

export const animateToPalette = (targetPalette: M3Palette, duration = 500) => {
	if (currentAnimFrame !== null) {
		cancelAnimationFrame(currentAnimFrame);
		currentAnimFrame = null;
	}

	const startPalette: M3Palette = {
		primary: [...currentPalette.primary],
		primaryContainer: [...currentPalette.primaryContainer],
		onPrimaryContainer: [...currentPalette.onPrimaryContainer],
	};

	const startTime = performance.now();

	const frame = (now: number) => {
		const elapsed = now - startTime;
		const progress = Math.min(1, elapsed / duration);
		// Easing standard: fast acceleration, smooth deceleration
		const t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

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

export const extractPaletteFromCover = (coverUrl: string): Promise<M3Palette | null> => {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = 32;
				canvas.height = 32;
				const ctx = canvas.getContext("2d");
				if (!ctx) return resolve(null);

				ctx.drawImage(img, 0, 0, 32, 32);
				const { data } = ctx.getImageData(0, 0, 32, 32);

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
					if (l < 0.18 || l > 0.82) continue; // skip extremes

					const s = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
					const score = s * 0.75 + (1 - Math.abs(l - 0.55)) * 0.25;

					if (score > maxScore) {
						maxScore = score;
						bestR = r;
						bestG = g;
						bestB = b;
					}
				}

				// Generate M3 dark theme color tones
				const primary: [number, number, number] = [
					Math.min(255, Math.round(bestR * 1.1 + 20)),
					Math.min(255, Math.round(bestG * 1.1 + 20)),
					Math.min(255, Math.round(bestB * 1.1 + 20)),
				];

				const primaryContainer: [number, number, number] = [
					Math.round(bestR * 0.35),
					Math.round(bestG * 0.35),
					Math.round(bestB * 0.35),
				];

				const onPrimaryContainer: [number, number, number] = [
					Math.min(255, Math.round(bestR * 1.2 + 60)),
					Math.min(255, Math.round(bestG * 1.2 + 60)),
					Math.min(255, Math.round(bestB * 1.2 + 60)),
				];

				resolve({ primary, primaryContainer, onPrimaryContainer });
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = coverUrl;
	});
};
