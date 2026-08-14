export interface M3Palette {
	primary: [number, number, number];
	primaryContainer: [number, number, number];
	onPrimaryContainer: [number, number, number];
	surfaceContainer: [number, number, number];
}

const defaultPalette: M3Palette = {
	primary: [201, 193, 255], // #c9c1ff
	primaryContainer: [70, 64, 117], // #464075
	onPrimaryContainer: [229, 222, 255], // #e5deff
	surfaceContainer: [37, 36, 44], // #25242c
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

export const animateToPalette = (targetPalette: M3Palette, duration = 400) => {
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
			surfaceContainer: defaultPalette.surfaceContainer,
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
	animateToPalette(defaultPalette, 300);
};

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
			} catch (_) {}
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

					let bestR = 201;
					let bestG = 193;
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

					const primary: [number, number, number] = [
						Math.min(255, Math.max(170, Math.round(bestR * 1.1 + 25))),
						Math.min(255, Math.max(160, Math.round(bestG * 1.1 + 25))),
						Math.min(255, Math.max(180, Math.round(bestB * 1.1 + 25))),
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

					const surfaceContainer: [number, number, number] = defaultPalette.surfaceContainer;

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
		return null;
	}
};
