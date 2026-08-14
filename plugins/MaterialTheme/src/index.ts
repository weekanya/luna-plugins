import { Tracer, type LunaUnload } from "@luna/core";
import { MediaItem, StyleTag } from "@luna/lib";
import { animateThemeTo, defaultM3DarkPalette, extractM3Palette, resetToDefaultTheme } from "./colorEngine";
import { settings } from "./Settings";

import themeStyles from "file://theme.css?minify";

export const { errSignal, trace } = Tracer("[MaterialTheme]");
export const unloads = new Set<LunaUnload>();

// Inject Global Material Design 3 Stylesheet
new StyleTag("MaterialThemeStyles", unloads, themeStyles);

// Listen to Tidal playback transitions for Dynamic Material You theme
MediaItem.onMediaTransition(unloads, async (mediaItem) => {
	if (!settings.dynamicTheme) return;

	try {
		const coverUrl = await mediaItem.coverUrl({ res: "160" }).catch(() => undefined);
		if (coverUrl) {
			const palette = await extractM3Palette(coverUrl);
			if (palette && settings.dynamicTheme) {
				animateThemeTo(palette, 600);
				return;
			}
		}
		if (settings.dynamicTheme) {
			resetToDefaultTheme();
		}
	} catch (e) {
		trace.err.withContext("onMediaTransition.palette")(e as Error);
	}
});

// Reset theme on plugin unload
unloads.add(() => {
	resetToDefaultTheme();
});

export { Settings } from "./Settings";
