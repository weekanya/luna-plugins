import React, { useEffect, useState } from "react";
import { downloadManager, type QueueState, type QueueTrack } from "./downloadManager";

export const DownloadModal: React.FC = () => {
	const [state, setState] = useState<QueueState>(downloadManager.getState());

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
	} = state;

	const activeTrack =
		tracks.find((t) => t.id === activeTrackId) ||
		tracks.find((t) => t.status === "downloading" || t.status === "checking");
	const pendingCount = Math.max(0, totalCount - completedCount - errorCount);

	// Floating Mini Widget (MD3 Extended FAB Style)
	if (isMinimized && tracks.length > 0) {
		const radius = 14;
		const circumference = 2 * Math.PI * radius;
		const strokeDashoffset = circumference - (overallPercent / 100) * circumference;

		return (
			<div className="sd-mini-widget" onClick={() => downloadManager.openModal()}>
				<div className="sd-mini-ring">
					<svg width="36" height="36">
						<circle className="bg" cx="18" cy="18" r={radius} />
						<circle
							className="progress"
							cx="18"
							cy="18"
							r={radius}
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
						/>
					</svg>
					<div className="sd-mini-ring-text">{overallPercent}%</div>
				</div>
				<div className="sd-mini-info">
					<div className="sd-mini-title">{activeTrack ? activeTrack.title : batchTitle}</div>
					<div className="sd-mini-status">
						{status === "running"
							? `Downloading (${completedCount}/${totalCount})`
							: status === "completed"
								? `All ${completedCount} downloaded`
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
						<div className="sd-header-icon">⚡</div>
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
							title="Minimize to widget"
							onClick={() => downloadManager.setMinimized(true)}
						>
							─
						</button>
						<button
							className="sd-icon-btn close"
							title="Close dialog"
							onClick={() => downloadManager.closeModal()}
						>
							✕
						</button>
					</div>
				</div>

				{/* MD3 RealMAX Status Bar & Switch (Section 4.11) */}
				<div className="sd-realmax-bar">
					<div className="sd-realmax-info">
						<span className={`sd-realmax-badge ${useRealMAX ? "on" : "off"}`}>
							{useRealMAX ? "⚡ RealMAX ON" : "RealMAX OFF"}
						</span>
						<div>
							<div className="sd-realmax-label">RealMAX Quality Finder</div>
							<div className="sd-realmax-desc">
								{useRealMAX
									? "Searches highest FLAC quality across all releases"
									: "Downloads standard selected quality"}
							</div>
						</div>
					</div>
					<div
						className={`md3-switch ${useRealMAX ? "checked" : ""}`}
						title="Toggle RealMAX quality finder"
						onClick={() => downloadManager.setRealMAX(!useRealMAX)}
					>
						<div className="md3-switch-thumb" />
					</div>
				</div>

				{/* MD3 Overall Progress Section (Section 4.13) */}
				<div className="sd-overall-section">
					<div className="sd-overall-meta">
						<div className="sd-overall-chips">
							<span className="md3-chip neutral">
								{completedCount} / {totalCount} tracks
							</span>
							{completedCount > 0 && <span className="md3-chip success">✓ {completedCount} Done</span>}
							{errorCount > 0 && <span className="md3-chip error">✗ {errorCount} Failed</span>}
							{pendingCount > 0 && status === "running" && (
								<span className="md3-chip neutral">⏳ {pendingCount} Remaining</span>
							)}
						</div>
						<span className="sd-overall-percent">{overallPercent}%</span>
					</div>
					<div className="md3-linear-progress">
						<div className="md3-linear-progress-bar" style={{ width: `${overallPercent}%` }} />
					</div>
				</div>

				{/* Active Track Highlight Card (MD3 Outlined Card 4.3) */}
				{activeTrack && (
					<div className="sd-active-card">
						{activeTrack.coverUrl ? (
							<img className="sd-active-cover" src={activeTrack.coverUrl} alt="Album Cover" />
						) : (
							<div className="sd-active-cover-placeholder">🎵</div>
						)}
						<div className="sd-active-info">
							<div>
								<div className="sd-active-title-row">
									<div className="sd-active-title" title={activeTrack.title}>
										{activeTrack.title}
									</div>
									{activeTrack.qualityName && (
										<span className="sd-quality-badge">{activeTrack.qualityName}</span>
									)}
								</div>
								<div className="sd-active-artist" title={activeTrack.artist}>
									{activeTrack.artist} {activeTrack.album ? `• ${activeTrack.album}` : ""}
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
							<TrackRow key={track.id} track={track} isActive={track.id === activeTrackId} />
						))
					)}
				</div>

				{/* MD3 Dialog Actions (Section 4.1 Buttons: 40dp height, 20dp radius) */}
				<div className="sd-footer">
					<div className="sd-footer-left">
						{status === "running" && (
							<button className="md3-btn tonal-error" onClick={() => downloadManager.cancel()}>
								⏹ Stop
							</button>
						)}
						{errorCount > 0 && (
							<button className="md3-btn tonal" onClick={() => downloadManager.retryAllFailed()}>
								🔁 Retry Failed ({errorCount})
							</button>
						)}
						{completedCount > 0 && status !== "running" && (
							<button className="md3-btn tonal" onClick={() => downloadManager.clearFinished()}>
								🧹 Clear Completed
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
						fontSize: "16px",
					}}
				>
					🎵
				</div>
			)}

			<div className="sd-track-details">
				<div className="sd-track-row-title" title={track.title}>
					{track.title}
				</div>
				<div className="sd-track-row-artist" title={track.artist}>
					{track.artist}
				</div>
				{track.error && <div className="sd-track-error-msg">{track.error}</div>}
			</div>

			{/* MD3 Status Chips & Action Buttons */}
			{track.status === "queued" && <span className="sd-status-badge queued">⏳ Queued</span>}
			{track.status === "checking" && <span className="sd-status-badge checking">⚡ Checking...</span>}
			{track.status === "downloading" && (
				<span className="sd-status-badge downloading">
					⬇️ {track.progressPercent}%
				</span>
			)}
			{track.status === "completed" && <span className="sd-status-badge completed">✓ Done</span>}
			{track.status === "error" && (
				<button
					className="md3-btn tonal-error"
					style={{ height: "28px", padding: "0 10px", fontSize: "11.5px", borderRadius: "14px" }}
					title="Retry download"
					onClick={() => downloadManager.retryTrack(track.id)}
				>
					🔁 Retry
				</button>
			)}
			{track.status === "cancelled" && (
				<button
					className="md3-btn tonal"
					style={{ height: "28px", padding: "0 10px", fontSize: "11.5px", borderRadius: "14px" }}
					title="Resume download"
					onClick={() => downloadManager.retryTrack(track.id)}
				>
					▶ Resume
				</button>
			)}
		</div>
	);
};
