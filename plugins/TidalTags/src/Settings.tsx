import { ReactiveStore } from "@luna/core";
import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";

export const settings = await ReactiveStore.getPluginStorage("TidalTags", {
	displayFormatBorder: true,
	displayQalityTags: true,
	displayFormatColumns: true,
	autoPopulateColumns: false,
});

export const Settings = () => {
	const [displayFormatBorder, setDisplayFormatBorder] = React.useState(settings.displayFormatBorder);
	const [displayQalityTags, setDisplayQalityTags] = React.useState(settings.displayQalityTags);
	const [displayFormatColumns, setDisplayFormatColumns] = React.useState(settings.displayFormatColumns);
	const [autoPopulateColumns, setAutoPopulateColumns] = React.useState(settings.autoPopulateColumns);
	return (
		<LunaSettings>
			<LunaSwitchSetting
				title="Quality tags"
				desc="Display quality tags in the tracklist"
				checked={displayQalityTags}
				onChange={(_, checked) => {
					setDisplayQalityTags((settings.displayQalityTags = checked));
				}}
			/>
			<LunaSwitchSetting
				title="Format columns"
				desc="Display format columns in the tracklist"
				checked={displayFormatColumns}
				onChange={(_, checked) => {
					setDisplayFormatColumns((settings.displayFormatColumns = checked));
				}}
			/>
			<LunaSwitchSetting
				title="Auto populate columns"
				desc="Populate clumns with format info without having to play the track"
				checked={autoPopulateColumns}
				onChange={(_, checked) => {
					setAutoPopulateColumns((settings.autoPopulateColumns = checked));
				}}
			/>
		</LunaSettings>
	);
};
