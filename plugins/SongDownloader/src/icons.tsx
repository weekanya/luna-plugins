import React from "react";

interface IconProps {
	size?: number;
	className?: string;
	style?: React.CSSProperties;
}

export const BoltIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C14.9 14.6 12.95 18 11 21z" />
	</svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M5 20h14v-2H5v2zm7-4l5-5h-4V4h-2v7H7l5 5z" />
	</svg>
);

export const CloudDownloadIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
	</svg>
);

export const MusicNoteIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
	</svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
	</svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
	</svg>
);

export const ErrorIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
	</svg>
);

export const ScheduleIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
	</svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
	</svg>
);

export const MinimizeIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M19 13H5v-2h14v2z" />
	</svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
	</svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M6 6h12v12H6z" />
	</svg>
);

export const PlayArrowIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M8 5v14l11-7z" />
	</svg>
);

export const ClearAllIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z" />
	</svg>
);

export const SyncIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
	</svg>
);

export const DescriptionIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
	<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
		<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
	</svg>
);
