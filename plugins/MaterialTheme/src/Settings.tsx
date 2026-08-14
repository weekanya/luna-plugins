import { ReactiveStore } from "@luna/core";
import { LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";
import { animateThemeTo, defaultM3DarkPalette, resetToDefaultTheme } from "./colorEngine";

export type MaterialThemeSettings = {
	dynamicTheme: boolean;
	glassmorphism: boolean;
	accentPreset: "purple" | "blue" | "emerald" | "sunset";
};

export const settings = await ReactiveStore.getPluginStorage<MaterialThemeSettings>("MaterialTheme", {
	dynamicTheme: true,
	glassmorphism: true,
	accentPreset: "purple",
});

if (settings.dynamicTheme === undefined) settings.dynamicTheme = true;
if (settings.glassmorphism === undefined) settings.glassmorphism = true;
if (settings.accentPreset === undefined) settings.accentPreset = "purple";

export const Settings = () => {
	const [dynamicTheme, setDynamicTheme] = React.useState(settings.dynamicTheme ?? true);
	const [glassmorphism, setGlassmorphism] = React.useState(settings.glassmorphism ?? true);
	const [accentPreset, setAccentPreset] = React.useState(settings.accentPreset ?? "purple");

	const applyPreset = (preset: "purple" | "blue" | "emerald" | "sunset") => {
		switch (preset) {
			case "blue":
				animateThemeTo({
					...defaultM3DarkPalette,
					primary: [168, 199, 250],
					onPrimary: [0, 50, 92],
					primaryContainer: [8, 66, 160],
					onPrimaryContainer: [211, 227, 253],
				});
				break;
			case "emerald":
				animateThemeTo({
					...defaultM3DarkPalette,
					primary: [110, 222, 178],
					onPrimary: [0, 56, 38],
					primaryContainer: [0, 82, 57],
					onPrimaryContainer: [142, 247, 202],
				});
				break;
			case "sunset":
				animateThemeTo({
					...defaultM3DarkPalette,
					primary: [255, 180, 160],
					onPrimary: [92, 26, 8],
					primaryContainer: [130, 42, 16],
					onPrimaryContainer: [255, 219, 210],
				});
				break;
			case "purple":
			default:
				resetToDefaultTheme();
				break;
		}
	};

	return (
		<LunaSettings>
			<LunaSwitchSetting
				title="Dynamic Material You Theme"
				desc="Automatically adapts Tidal interface colors and player accents to the currently playing song's album art"
				checked={dynamicTheme}
				onChange={(_: any, checked: boolean) => {
					settings.dynamicTheme = checked;
					setDynamicTheme(checked);
					if (!checked) {
						applyPreset(accentPreset);
					}
				}}
			/>
			<LunaSwitchSetting
				title="Glassmorphism & Frosted Blur"
				desc="Enables translucent frosted glass blur on the bottom player bar, sidebar, and context menus"
				checked={glassmorphism}
				onChange={(_: any, checked: boolean) => {
					settings.glassmorphism = checked;
					setGlassmorphism(checked);
					document.documentElement.style.setProperty(
						"--md-glass-blur",
						checked ? "blur(24px) saturate(180%)" : "none",
					);
				}}
			/>
			<LunaSelectSetting
				title="Default Accent Color Preset"
				desc="Default Material Design 3 color palette when dynamic theme is disabled"
				value={accentPreset}
				onChange={(e: any) => {
					const val = e.target.value as "purple" | "blue" | "emerald" | "sunset";
					settings.accentPreset = val;
					setAccentPreset(val);
					if (!dynamicTheme) {
						applyPreset(val);
					}
				}}
			>
				<LunaSelectItem value="purple" children="Material Lavender Purple (Default)" />
				<LunaSelectItem value="blue" children="Google Ocean Blue" />
				<LunaSelectItem value="emerald" children="Emerald Mint" />
				<LunaSelectItem value="sunset" children="Sunset Coral" />
			</LunaSelectSetting>
		</LunaSettings>
	);
};
