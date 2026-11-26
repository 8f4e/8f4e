export function formatBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	return `${(bytes / 1024).toFixed(1)} KiB`;
}

export function formatCompactBytes(bytes: number) {
	if (Math.abs(bytes) < 1024) {
		return `${bytes} B`;
	}

	return `${Math.round(bytes / 1024)} KiB`;
}

export function formatCount(value: number) {
	return new Intl.NumberFormat(undefined).format(value);
}

export function formatCompactCount(value: number) {
	return new Intl.NumberFormat(undefined, {
		notation: 'compact',
		maximumFractionDigits: 1,
	}).format(value);
}

export function formatPercent(value: number) {
	return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

export function shortCommit(commit: string) {
	return commit.slice(0, 8);
}

export function formatDateTime(date: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

export function formatReleaseMeta(point: { releaseTag: string; commit: string }) {
	return `${point.releaseTag} · ${shortCommit(point.commit)}`;
}
