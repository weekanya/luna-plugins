import React, { useEffect, useRef, useState } from "react";
import { animateToPalette, extractPaletteFromCover, resetDynamicTheme } from "./colorTheme";
import { downloadManager, type QueueState, type QueueTrack } from "./downloadManager";
import {
	BoltIcon,
	CheckIcon,
	ClearAllIcon,
	CloseIcon,
	CloudDownloadIcon,
	ErrorIcon,
	MinimizeIcon,
	MusicNoteIcon,
	PlayArrowIcon,
	RefreshIcon,
	ScheduleIcon,
	StopIcon,
	SyncIcon,
} from "./icons";
import { settings } from "./Settings";

export const DownloadModal: React.FC = () => {
	const [state, setState] = useState<QueueState>(downloadManager.getState());

	// Draggable widget state
	const [widgetPos, setWidgetPos] = useState<{ x: number; y: number } | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number; hasMoved: boolean }>({
		startX: 0,
		startY: 0,
		posX: 0,
		posY: 0,
		hasMoved: false,
	});

	useEffect(() => {
		return downloadManager.subscribe(setState);
	}, []);

	const {
		isOpen,
		isMinimized,
		batchTitle,
		tracks,
		activeTrackId,
		status,
		completedCount,
		errorCount,
		totalCount,
		overallPercent,
		useRealMAX,
		concurrentDownloads = 2,
		dynamicTheme = true,
	} = state;

	const activeTrack =
		tracks.find((t) => t.id === activeTrackId) ||
		tracks.find((t) => t.status === "downloading" || t.status === "checking") ||
		tracks.find((t) => t.status === "queued");

	const pendingCount = Math.max(0, totalCount - completedCount - errorCount);

	// Dynamic Material You Theme based on active track cover
	useEffect(() => {
		if (dynamicTheme && activeTrack?.coverUrl && (isOpen || isMinimized)) {
			extractPaletteFromCover(activeTrack.coverUrl).then((palette) => {
				if (palette && downloadManager.getState().dynamicTheme) {
					animateToPalette(palette, 600);
				}
			});
		} else {
			resetDynamicTheme();
		}
	}, [activeTrack?.coverUrl, dynamicTheme, isOpen, isMinimized]);

	// Draggable Pointer Event Handlers for Mini Widget
	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const target = e.currentTarget;
		const rect = target.getBoundingClientRect();
		const currentX = widgetPos ? widgetPos.x : rect.left;
		const currentY = widgetPos ? widgetPos.y : rect.top;

		dragStartRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			posX: currentX,
			posY: currentY,
			hasMoved: false,
		};

		setIsDragging(true);

		const handlePointerMove = (moveEv: PointerEvent) => {
			const dx = moveEv.clientX - dragStartRef.current.startX;
			const dy = moveEv.clientY - dragStartRef.current.startY;

			if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
				dragStartRef.current.hasMoved = true;
			}

			const newX = Math.max(10, Math.min(window.innerWidth - 340, dragStartRef.current.posX + dx));
			const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.posY + dy));

			setWidgetPos({ x: newX, y: newY });
		};

		const handlePointerUp = () => {
			setIsDragging(false);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
	};

	// Floating Mini Widget (MD3 Extended FAB Style)
	if (isMinimized && tracks.length > 0) {
		const radius = 14;
		const circumference = 2 * Math.PI * radius;
		const currentTrackPercent = activeTrack ? activeTrack.progressPercent : overallPercent || 0;
		const strokeDashoffset = circumference - (currentTrackPercent / 100) * circumference;

		const widgetStyle: React.CSSProperties = widgetPos
			? {
					left: `${widgetPos.x}px`,
					top: `${widgetPos.y}px`,
					right: "auto",
					bottom: "auto",
				}
			: {};

		return (
			<div
				className={`sd-mini-widget ${isDragging ? "dragging" : ""}`}
				style={widgetStyle}
				onPointerDown={handlePointerDown}
				onClick={() => {
					if (!dragStartRef.current.hasMoved) {
						downloadManager.openModal();
					}
				}}
			>
				{activeTrack?.coverUrl ? (
					<img className="sd-mini-cover" src={activeTrack.coverUrl} alt="" />
				) : (
					<div className="sd-mini-cover-placeholder">🎵</div>
				)}
				<div className="sd-mini-ring">
					<svg width="38" height="38">
						<circle className="bg" cx="19" cy="19" r={radius} />
						<circle
							className="progress"
							cx="19"
							cy="19"
							r={radius}
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
						/>
					</svg>
					<div className="sd-mini-ring-text">{currentTrackPercent}%</div>
				</div>
				<div className="sd-mini-info">
					<div className="sd-mini-title">{activeTrack ? activeTrack.title : batchTitle}</div>
					<div className="sd-mini-status">
						{activeTrack && activeTrack.status === "downloading"
							? `${activeTrack.downloadedMB || "0"} / ${activeTrack.totalMB || "0"} MB (${activeTrack.progressPercent}%)`
							: status === "running"
								? `Downloading (${completedCount}/${totalCount})`
								: status === "completed"
									? `All ${completedCount} done`
									: `${completedCount} done, ${errorCount} errors`}
					</div>
				</div>
			</div>
		);
	}

	if (!isOpen) return null;

	return (
		<div
			className="sd-overlay"
			onClick={(e) => {
				if (e.target === e.currentTarget) downloadManager.closeModal();
			}}
		>
			<div className="sd-modal">
				{/* MD3 Dialog Header (Section 4.6) */}
				<div className="sd-header">
					<div className="sd-header-left">
						<div className="sd-header-icon">
							<CloudDownloadIcon size={22} />
						</div>
						<div className="sd-header-title-wrap">
							<div className="sd-header-title" title={batchTitle}>
								{batchTitle}
							</div>
							<div className="sd-header-subtitle">
								{totalCount > 0 ? `${totalCount} tracks in queue` : "Download Manager"}
							</div>
						</div>
					</div>
					<div className="sd-header-actions">
						<button
							className="sd-icon-btn"
							title="Minimize to floating widget"
							onClick={() => downloadManager.setMinimized(true)}
						>
							<MinimizeIcon size={18} />
						</button>
						<button
							className="sd-icon-btn close"
							title="Close dialog"
							onClick={() => downloadManager.closeModal()}
						>
							<CloseIcon size={18} />
						</button>
					</div>
				</div>

				{/* MD3 RealMAX & Concurrency Speed Bar */}
				<div className="sd-realmax-bar">
					<div className="sd-realmax-info">
						<span className={`sd-realmax-badge ${useRealMAX ? "on" : "off"}`}>
							<BoltIcon size={14} style={{ marginRight: 4 }} />
							{useRealMAX ? "RealMAX Active" : "RealMAX Disabled"}
						</span>
						<div>
							<div className="sd-realmax-label">RealMAX Quality Finder</div>
							<div className="sd-realmax-desc">
								{useRealMAX
									? "Automatically finds the highest FLAC audio quality"
									: "Downloads the default selected quality"}
							</div>
						</div>
					</div>
					<div className="sd-toolbar-controls">
						{/* Concurrency Threads Selector in 1-Click */}
						<button
							className="sd-threads-btn"
							title="Click to cycle parallel download threads (1x, 2x, 3x, 4x)"
							onClick={() =>
								downloadManager.setConcurrentDownloads(
									concurrentDownloads >= 4 ? 1 : concurrentDownloads + 1,
								)
							}
						>
							<BoltIcon size={14} />
							<span>{concurrentDownloads}x Threads</span>
						</button>
						<div
							className={`md3-switch ${useRealMAX ? "checked" : ""}`}
							title="Toggle RealMAX quality finder"
							onClick={() => downloadManager.setRealMAX(!useRealMAX)}
						>
							<div className="md3-switch-thumb" />
						</div>
					</div>
				</div>

				{/* MD3 Overall Progress Section (Section 4.13) */}
				<div className="sd-overall-section">
					<div className="sd-overall-meta">
						<div className="sd-overall-chips">
							<span className="md3-chip neutral">
								<CloudDownloadIcon size={14} />
								{completedCount} / {totalCount} tracks
							</span>
							{completedCount > 0 && (
								<span className="md3-chip success">
									<CheckIcon size={14} />
									{completedCount} Completed
								</span>
							)}
							{errorCount > 0 && (
								<span className="md3-chip error">
									<ErrorIcon size={14} />
									{errorCount} Failed
								</span>
							)}
							{pendingCount > 0 && (status === "running" || status === "cancelling") && (
								<span className="md3-chip neutral">
									<ScheduleIcon size={14} />
									{pendingCount} Remaining
								</span>
							)}
						</div>
						<span className="sd-overall-percent">{overallPercent}%</span>
					</div>
					<div className="md3-linear-progress">
						<div className="md3-linear-progress-bar" style={{ width: `${overallPercent}%` }} />
					</div>
				</div>

				{/* Active Track Highlight Card (MD3 Outlined Card 4.3 - Never Collapses) */}
				{activeTrack && (
					<div className="sd-active-card">
						{activeTrack.coverUrl ? (
							<img className="sd-active-cover" src={activeTrack.coverUrl} alt="Album Cover" />
						) : (
							<div className="sd-active-cover-placeholder">
								<MusicNoteIcon size={28} />
							</div>
						)}
						<div className="sd-active-info">
							<div>
								<div className="sd-active-title" title={activeTrack.title}>
									{activeTrack.title}
								</div>
								<div className="sd-active-artist" title={activeTrack.artist}>
									{activeTrack.artist} {activeTrack.album ? `• ${activeTrack.album}` : ""}
								</div>
								<div className="sd-active-badges">
									{activeTrack.qualityName && (
										<span className="sd-quality-badge">{activeTrack.qualityName}</span>
									)}
									{activeTrack.formatInfo && (
										<span className="sd-format-badge">{activeTrack.formatInfo}</span>
									)}
								</div>
							</div>

							<div className="sd-active-progress-wrap">
								<div className="md3-linear-progress">
									<div
										className="md3-linear-progress-bar"
										style={{ width: `${activeTrack.progressPercent}%` }}
									/>
								</div>
								<div className="sd-active-progress-meta">
									<span className="sd-active-progress-status">{activeTrack.statusText}</span>
									<span>{activeTrack.progressPercent}%</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* MD3 Track List */}
				<div className="sd-track-list">
					{tracks.length === 0 ? (
						<div
							style={{
								textAlign: "center",
								padding: "36px 0",
								color: "var(--md-sys-color-on-surface-variant)",
								fontSize: "14px",
							}}
						>
							No tracks in download queue.
						</div>
					) : (
						tracks.map((track) => (
							<TrackRow key={track.id} track={track} isActive={track.id === activeTrack?.id} />
						))
					)}
				</div>

				{/* MD3 Dialog Actions (Section 4.1 Buttons: 40dp height, 20dp radius) */}
				<div className="sd-footer">
					<div className="sd-footer-left">
						{(status === "running" || status === "cancelling") && (
							<button className="md3-btn tonal-error" onClick={() => downloadManager.cancel()}>
								<StopIcon size={16} />
								{status === "cancelling" ? "Stopping..." : "Stop"}
							</button>
						)}
						{errorCount > 0 && (
							<button className="md3-btn tonal" onClick={() => downloadManager.retryAllFailed()}>
								<RefreshIcon size={16} />
								Retry Failed ({errorCount})
							</button>
						)}
						{completedCount > 0 && status !== "running" && (
							<button className="md3-btn tonal" onClick={() => downloadManager.clearFinished()}>
								<CheckIcon size={16} />
								Clear Completed
							</button>
						)}
						{tracks.length > 0 && status !== "running" && (
							<button
								className="md3-btn text"
								onClick={() => downloadManager.clearAll()}
								title="Clear all download history"
							>
								<ClearAllIcon size={16} />
								Clear All
							</button>
						)}
					</div>
					<button className="md3-btn filled" onClick={() => downloadManager.closeModal()}>
						Close
					</button>
				</div>
			</div>
		</div>
	);
};

interface TrackRowProps {
	track: QueueTrack;
	isActive: boolean;
}

const TrackRow: React.FC<TrackRowProps> = ({ track, isActive }) => {
	let rowClass = "sd-track-row";
	if (isActive) rowClass += " active";
	if (track.status === "error") rowClass += " error";
	if (track.status === "completed") rowClass += " completed";

	return (
		<div className={rowClass}>
			<span className="sd-track-num">#{track.index}</span>

			{track.coverUrl ? (
				<img className="sd-track-cover-mini" src={track.coverUrl} alt="" />
			) : (
				<div
					className="sd-track-cover-mini"
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--md-sys-color-on-surface-variant)",
					}}
				>
					<MusicNoteIcon size={18} />
				</div>
			)}

			<div className="sd-track-details">
				<div className="sd-track-row-title" title={track.title}>
					{track.title}
				</div>
				<div className="sd-track-row-artist" title={track.artist}>
					{track.artist}
				</div>
				{track.formatInfo && (
					<div className="sd-track-badges">
						<span className="sd-format-badge">{track.formatInfo}</span>
					</div>
				)}
				{track.error && <div className="sd-track-error-msg">{track.error}</div>}
			</div>

			{/* MD3 Status Chips & Action Buttons with Google Icons */}
			{track.status === "queued" && (
				<span className="sd-status-badge queued">
					<ScheduleIcon size={13} />
					Queued
				</span>
			)}
			{track.status === "checking" && (
				<span className="sd-status-badge checking">
					<SyncIcon size={13} />
					Checking...
				</span>
			)}
			{track.status === "downloading" && (
				<span className="sd-status-badge downloading">
					<CloudDownloadIcon size={13} />
					{track.progressPercent}%
				</span>
			)}
			{track.status === "completed" && (
				<span className="sd-status-badge completed">
					<CheckIcon size={13} />
					Done
				</span>
			)}
			{track.status === "error" && (
				<button
					className="md3-btn tonal-error"
					style={{ height: "28px", padding: "0 10px", fontSize: "11.5px", borderRadius: "14px" }}
					title="Retry download"
					onClick={() => downloadManager.retryTrack(track.id)}
				>
					<RefreshIcon size={13} />
					Retry
				</button>
			)}
			{track.status === "cancelled" && (
				<button
					className="md3-btn tonal"
					style={{ height: "28px", padding: "0 10px", fontSize: "11.5px", borderRadius: "14px" }}
					title="Resume download"
					onClick={() => downloadManager.retryTrack(track.id)}
				>
					<PlayArrowIcon size={13} />
					Resume
				</button>
			)}
		</div>
	);
};
