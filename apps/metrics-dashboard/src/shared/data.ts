import { shortCommit } from './format';

export type PackageLog = {
	packageName: string;
	label: string;
	path: string;
};

export type BenchmarkLog = {
	benchmark: string;
	label: string;
	path: string;
};

export type ReportData<TLog, TPoint> = {
	logs: TLog[];
	points: TPoint[];
};

/** Load one report's manifest and its entries, preserving manifest order. */
export async function loadReportData<TLog extends { path: string }, TEntry, TPoint>(
	directory: string,
	manifestLabel: string,
	toPoints: (log: TLog, entries: TEntry[]) => TPoint[],
	indexPoints: (points: TPoint[]) => TPoint[] = points => points
): Promise<ReportData<TLog, TPoint>> {
	const manifestResponse = await fetch(`${directory}/manifest.json`, { cache: 'no-store' });

	if (!manifestResponse.ok) {
		throw new Error(`Failed to load ${manifestLabel} manifest: ${manifestResponse.status}`);
	}

	const { logs } = (await manifestResponse.json()) as { logs: TLog[] };
	const groups = await Promise.all(
		logs.map(async log => {
			const response = await fetch(`${directory}/${log.path}`, { cache: 'no-store' });

			if (!response.ok) {
				throw new Error(`Failed to load ${log.path}: ${response.status}`);
			}

			return toPoints(log, (await response.json()) as TEntry[]);
		})
	);

	return { logs, points: indexPoints(groups.flat()) };
}

export function withSequentialReleaseIndexes<TPoint extends { releaseKey: string; commit: string; version: string }>(
	points: TPoint[]
) {
	const releases = [...new Map(points.map(point => [point.releaseKey, point])).values()].map((point, index) => ({
		key: point.releaseKey,
		index,
		label: `${index + 1} · ${point.version}`,
	}));
	return applyReleaseIndexes(points, releases);
}

export function withRecordedReleaseIndexes<TPoint extends { releaseKey: string; recordedAt: Date; commit: string }>(
	points: TPoint[]
) {
	const releases = [...new Map(points.map(point => [point.releaseKey, point])).values()]
		.sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
		.map((point, index) => ({
			key: point.releaseKey,
			index,
			label: `${index + 1} · ${shortCommit(point.commit)}`,
		}));
	return applyReleaseIndexes(points, releases);
}

function applyReleaseIndexes<TPoint extends { releaseKey: string }>(
	points: TPoint[],
	releases: { key: string; index: number; label: string }[]
) {
	const releaseByKey = new Map(releases.map(release => [release.key, release]));
	return points.map(point => {
		// The releases list was constructed from these points, so every key is present.
		const release = releaseByKey.get(point.releaseKey)!;

		return {
			...point,
			releaseIndex: release.index,
			releaseLabel: release.label,
		};
	});
}

export function getLatestReleasePoints<TPoint extends { releaseIndex: number }>(points: TPoint[]) {
	const latestReleaseIndex = Math.max(-1, ...points.map(point => point.releaseIndex));

	return points.filter(point => point.releaseIndex === latestReleaseIndex);
}

export function getCoveragePercentage(covered: number, total: number) {
	if (total === 0) {
		return 100;
	}

	return Number(((covered / total) * 100).toFixed(1));
}
