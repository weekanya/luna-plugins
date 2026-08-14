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
	} = state;

	// Active track object
	const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks.find((t) => t.status === "downloading" || t.status === "checking");
	const pendingCount = Math.max(0, totalCount - completedCount - errorCount);

	// If minimized, render the floating mini-widget
	if (isMinimized && tracks.length > 0) {
		const radius = 14;
		const circumference = 2 * Math.PI * radius;
		const strokeDashoffset = circumference - (overallPercent / 100) * circumference;

		return (
			<div className="sd-mini-widget" onClick={() => downloadManager.openModal()}>
				<div className="sd-mini-ring">
					<svg width="36" height="36">
						<defs>
							<linearGradient id="sd-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stopColor="#9e46ff" />
								<stop offset="100%" stopColor="#31d8ff" />
							</linearGradient>
						</defs>
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
				{/* Modal Header */}
				<div className="sd-header">
					<div className="sd-header-left">
						<div className="sd-header-icon">⚡</div>
						<div className="sd-header-title">{batchTitle}</div>
					</div>
					<div className="sd-header-actions">
						<button
							className="sd-icon-btn"
							title="Minimize to widget"
							onClick={() => downloadManager.setMinimized(true)}
						>
							_
						</button>
						<button
							className="sd-icon-btn close"
							title="Close window"
							onClick={() => downloadManager.closeModal()}
						>
							✕
						</button>
					</div>
				</div>

				{/* Overall Progress Section */}
				<div className="sd-overall-section">
					<div className="sd-overall-meta">
						<div className="sd-overall-stats">
							<span className="sd-stat-pill pending">
								{completedCount} of {totalCount} tracks
							</span>
							{completedCount > 0 && <span className="sd-stat-pill success">✓ {completedCount} Done</span>}
							{errorCount > 0 && <span className="sd-stat-pill error">✗ {errorCount} Failed</span>}
							{pendingCount > 0 && status === "running" && (
								<span className="sd-stat-pill pending">⏳ {pendingCount} Remaining</span>
							)}
						</div>
						<span style={{ fontWeight: 700, fontSize: "13px", color: "var(--sd-secondary)" }}>
							{overallPercent}%
						</span>
					</div>
					<div className="sd-progress-bar-bg">
						<div className="sd-progress-bar-fill" style={{ width: `${overallPercent}%` }} />
					</div>
				</div>

				{/* Active Track Highlight Card */}
				{activeTrack && (
					<div className="sd-active-card">
						{activeTrack.coverUrl ? (
							<img className="sd-active-cover" src={activeTrack.coverUrl} alt="Cover" />
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
								<div className="sd-progress-bar-bg" style={{ height: "4px" }}>
									<div
										className="sd-progress-bar-fill"
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

				{/* Track List */}
				<div className="sd-track-list">
					{tracks.length === 0 ? (
						<div style={{ textAlign: "center", padding: "30px", color: "#71717a", fontSize: "13px" }}>
							No tracks in download queue.
						</div>
					) : (
						tracks.map((track) => (
							<TrackRow key={track.id} track={track} isActive={track.id === activeTrackId} />
						))
					)}
				</div>

				{/* Footer Controls */}
				<div className="sd-footer">
					<div className="sd-footer-left">
						{status === "running" && (
							<button className="sd-btn danger" onClick={() => downloadManager.cancel()}>
								⏹ Stop
							</button>
						)}
						{errorCount > 0 && (
							<button className="sd-btn secondary" onClick={() => downloadManager.retryAllFailed()}>
								🔁 Retry Failed ({errorCount})
							</button>
						)}
						{completedCount > 0 && status !== "running" && (
							<button className="sd-btn secondary" onClick={() => downloadManager.clearFinished()}>
								🧹 Clear Completed
							</button>
						)}
					</div>
					<button className="sd-btn primary" onClick={() => downloadManager.closeModal()}>
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
						fontSize: "14px",
						background: "rgba(255,255,255,0.05)",
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

			{/* Status pill / Actions */}
			{track.status === "queued" && <span className="sd-status-badge queued">⏳ Queued</span>}
			{track.status === "checking" && <span className="sd-status-badge downloading">⚡ Checking...</span>}
			{track.status === "downloading" && (
				<span className="sd-status-badge downloading">
					⬇️ {track.progressPercent}%
				</span>
			)}
			{track.status === "completed" && <span className="sd-status-badge completed">✓ Downloaded</span>}
			{track.status === "error" && (
				<button
					className="sd-retry-btn"
					title="Retry download"
					onClick={() => downloadManager.retryTrack(track.id)}
				>
					🔁 Retry
				</button>
			)}
			{track.status === "cancelled" && (
				<button
					className="sd-retry-btn"
					title="Resume download"
					onClick={() => downloadManager.retryTrack(track.id)}
				>
					▶ Resume
				</button>
			)}
		</div>
	);
};
