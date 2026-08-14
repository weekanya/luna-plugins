export interface M3ThemePalette {
	primary: [number, number, number];
	onPrimary: [number, number, number];
	primaryContainer: [number, number, number];
	onPrimaryContainer: [number, number, number];
	surface: [number, number, number];
	surfaceContainerLow: [number, number, number];
	surfaceContainer: [number, number, number];
	surfaceContainerHigh: [number, number, number];
	surfaceContainerHighest: [number, number, number];
	outlineVariant: [number, number, number];
}

export const defaultM3DarkPalette: M3ThemePalette = {
	primary: [208, 188, 255],
	onPrimary: [56, 30, 114],
	primaryContainer: [79, 55, 139],
	onPrimaryContainer: [234, 221, 255],
	surface: [20, 18, 24],
	surfaceContainerLow: [29, 27, 32],
	surfaceContainer: [33, 31, 38],
	surfaceContainerHigh: [43, 41, 48],
	surfaceContainerHighest: [54, 52, 59],
	outlineVariant: [73, 69, 79],
};

let currentThemePalette: M3ThemePalette = { ...defaultM3DarkPalette };
let animFrameId: number | null = null;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export const applyPaletteToRoot = (palette: M3ThemePalette) => {
	const root = document.documentElement;

	const rgbStr = (c: [number, number, number]) => `rgb(${c.join(",")})`;
	const rawStr = (c: [number, number, number]) => c.join(",");

	const vars: Record<string, string> = {
		// Material Design 3 HCT Tokens
		"--md-sys-color-primary": rgbStr(palette.primary),
		"--md-sys-color-on-primary": rgbStr(palette.onPrimary),
		"--md-sys-color-primary-container": rgbStr(palette.primaryContainer),
		"--md-sys-color-on-primary-container": rgbStr(palette.onPrimaryContainer),
		"--md-sys-color-surface": rgbStr(palette.surface),
		"--md-sys-color-surface-container-low": rgbStr(palette.surfaceContainerLow),
		"--md-sys-color-surface-container": rgbStr(palette.surfaceContainer),
		"--md-sys-color-surface-container-high": rgbStr(palette.surfaceContainerHigh),
		"--md-sys-color-surface-container-highest": rgbStr(palette.surfaceContainerHighest),
		"--md-sys-color-outline-variant": rgbStr(palette.outlineVariant),

		// Tidal System Wave Variable Overrides
		"--wave-color-solid-accent-fill": rgbStr(palette.primary),
		"--wave-color-interactive-primary": rgbStr(palette.primary),
		"--wave-color-solid-base-primary": rgbStr(palette.surface),
		"--wave-color-solid-base-secondary": rgbStr(palette.surfaceContainer),
		"--wave-color-background-primary": rgbStr(palette.surface),
		"--wave-color-background-secondary": rgbStr(palette.surfaceContainerLow),
		"--wave-color-background-tertiary": rgbStr(palette.surfaceContainerHigh),

		// Raw colors for alpha blends
		"--md-primary-raw": rawStr(palette.primary),
		"--md-surface-raw": rawStr(palette.surface),
		"--md-surface-container-raw": rawStr(palette.surfaceContainer),
	};

	for (const [key, val] of Object.entries(vars)) {
		root.style.setProperty(key, val);
	}
};

export const animateThemeTo = (targetPalette: M3ThemePalette, duration = 600) => {
	if (animFrameId !== null) {
		cancelAnimationFrame(animFrameId);
		animFrameId = null;
	}

	const startPalette: M3ThemePalette = {
		primary: [...currentThemePalette.primary],
		onPrimary: [...currentThemePalette.onPrimary],
		primaryContainer: [...currentThemePalette.primaryContainer],
		onPrimaryContainer: [...currentThemePalette.onPrimaryContainer],
		surface: [...currentThemePalette.surface],
		surfaceContainerLow: [...currentThemePalette.surfaceContainerLow],
		surfaceContainer: [...currentThemePalette.surfaceContainer],
		surfaceContainerHigh: [...currentThemePalette.surfaceContainerHigh],
		surfaceContainerHighest: [...currentThemePalette.surfaceContainerHighest],
		outlineVariant: [...currentThemePalette.outlineVariant],
	};

	const startTime = performance.now();

	const frame = (now: number) => {
		const elapsed = now - startTime;
		const progress = Math.min(1, elapsed / duration);
		// MD3 Emphasized Decelerate Easing
		const t = 1 - Math.pow(1 - progress, 3);

		const lerpColor = (c1: [number, number, number], c2: [number, number, number]): [number, number, number] => [
			lerp(c1[0], c2[0], t),
			lerp(c1[1], c2[1], t),
			lerp(c1[2], c2[2], t),
		];

		currentThemePalette = {
			primary: lerpColor(startPalette.primary, targetPalette.primary),
			onPrimary: lerpColor(startPalette.onPrimary, targetPalette.onPrimary),
			primaryContainer: lerpColor(startPalette.primaryContainer, targetPalette.primaryContainer),
			onPrimaryContainer: lerpColor(startPalette.onPrimaryContainer, targetPalette.onPrimaryContainer),
			surface: lerpColor(startPalette.surface, targetPalette.surface),
			surfaceContainerLow: lerpColor(startPalette.surfaceContainerLow, targetPalette.surfaceContainerLow),
			surfaceContainer: lerpColor(startPalette.surfaceContainer, targetPalette.surfaceContainer),
			surfaceContainerHigh: lerpColor(startPalette.surfaceContainerHigh, targetPalette.surfaceContainerHigh),
			surfaceContainerHighest: lerpColor(startPalette.surfaceContainerHighest, targetPalette.surfaceContainerHighest),
			outlineVariant: lerpColor(startPalette.outlineVariant, targetPalette.outlineVariant),
		};

		applyPaletteToRoot(currentThemePalette);

		if (progress < 1) {
			animFrameId = requestAnimationFrame(frame);
		} else {
			animFrameId = null;
		}
	};

	animFrameId = requestAnimationFrame(frame);
};

export const resetToDefaultTheme = () => {
	animateThemeTo(defaultM3DarkPalette, 400);
};

/**
 * Extracts vibrant dominant tones from album cover via Blob to avoid CORS canvas taint in Electron
 */
export const extractM3Palette = async (coverUrl: string): Promise<M3ThemePalette | null> => {
	try {
		let blobUrl = coverUrl;
		let isBlob = false;

		if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
			try {
				const res = await fetch(coverUrl);
				if (res.ok) {
					const blob = await res.blob();
					blobUrl = URL.createObjectURL(blob);
					isBlob = true;
				}
			} catch (_) {}
		}

		return await new Promise<M3ThemePalette | null>((resolve) => {
			const img = new Image();
			img.onload = () => {
				try {
					const canvas = document.createElement("canvas");
					canvas.width = 32;
					canvas.height = 32;
					const ctx = canvas.getContext("2d", { willReadFrequently: true });
					if (!ctx) {
						if (isBlob) URL.revokeObjectURL(blobUrl);
						return resolve(null);
					}

					ctx.drawImage(img, 0, 0, 32, 32);
					const { data } = ctx.getImageData(0, 0, 32, 32);
					if (isBlob) URL.revokeObjectURL(blobUrl);

					let bestR = 208,
						bestG = 188,
						bestB = 255;
					let maxScore = -1;

					for (let i = 0; i < data.length; i += 4) {
						const r = data[i],
							g = data[i + 1],
							b = data[i + 2],
							a = data[i + 3];
						if (a < 128) continue;

						const max = Math.max(r, g, b);
						const min = Math.min(r, g, b);
						const l = (max + min) / 510;
						if (l < 0.15 || l > 0.85) continue;

						const s = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
						const score = s * 0.8 + (1 - Math.abs(l - 0.55)) * 0.2;

						if (score > maxScore) {
							maxScore = score;
							bestR = r;
							bestG = g;
							bestB = b;
						}
					}

					// Harmonious Material Design 3 HCT Dark Palette
					const primary: [number, number, number] = [
						Math.min(255, Math.max(170, Math.round(bestR * 1.1 + 25))),
						Math.min(255, Math.max(160, Math.round(bestG * 1.1 + 25))),
						Math.min(255, Math.max(180, Math.round(bestB * 1.1 + 25))),
					];

					const onPrimary: [number, number, number] = [
						Math.max(0, Math.round(bestR * 0.2)),
						Math.max(0, Math.round(bestG * 0.2)),
						Math.max(0, Math.round(bestB * 0.2 + 20)),
					];

					const primaryContainer: [number, number, number] = [
						Math.round(bestR * 0.35 + 25),
						Math.round(bestG * 0.35 + 20),
						Math.round(bestB * 0.35 + 40),
					];

					const onPrimaryContainer: [number, number, number] = [
						Math.min(255, Math.round(bestR * 1.25 + 45)),
						Math.min(255, Math.round(bestG * 1.25 + 45)),
						Math.min(255, Math.round(bestB * 1.25 + 45)),
					];

					const surface: [number, number, number] = [
						Math.round(18 + bestR * 0.03),
						Math.round(16 + bestG * 0.03),
						Math.round(22 + bestB * 0.03),
					];

					const surfaceContainerLow: [number, number, number] = [
						Math.round(25 + bestR * 0.04),
						Math.round(23 + bestG * 0.04),
						Math.round(30 + bestB * 0.04),
					];

					const surfaceContainer: [number, number, number] = [
						Math.round(30 + bestR * 0.05),
						Math.round(28 + bestG * 0.05),
						Math.round(36 + bestB * 0.05),
					];

					const surfaceContainerHigh: [number, number, number] = [
						Math.round(38 + bestR * 0.06),
						Math.round(36 + bestG * 0.06),
						Math.round(46 + bestB * 0.06),
					];

					const surfaceContainerHighest: [number, number, number] = [
						Math.round(48 + bestR * 0.07),
						Math.round(46 + bestG * 0.07),
						Math.round(58 + bestB * 0.07),
					];

					const outlineVariant: [number, number, number] = [
						Math.round(65 + bestR * 0.08),
						Math.round(60 + bestG * 0.08),
						Math.round(75 + bestB * 0.08),
					];

					resolve({
						primary,
						onPrimary,
						primaryContainer,
						onPrimaryContainer,
						surface,
						surfaceContainerLow,
						surfaceContainer,
						surfaceContainerHigh,
						surfaceContainerHighest,
						outlineVariant,
					});
				} catch (err) {
					if (isBlob) URL.revokeObjectURL(blobUrl);
					resolve(null);
				}
			};
			img.onerror = () => {
				if (isBlob) URL.revokeObjectURL(blobUrl);
				resolve(null);
			};
			img.src = blobUrl;
		});
	} catch (e) {
		return null;
	}
};
