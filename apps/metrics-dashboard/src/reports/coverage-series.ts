export type CoverageMeasurementMode = 'legacy' | 'jitless';

export type CoverageRuntime = {
	key: string;
	label: string;
};

export type CoverageMeasurement = {
	measurementMode: CoverageMeasurementMode;
	runtime: CoverageRuntime | null;
};

/** Historic JIT-enabled rows form their own series; deterministic rows are scoped to their runtime. */
export function getCoverageMeasurement(entry: {
	measurementMode?: string;
	nodeVersion?: string;
	v8Version?: string;
}): CoverageMeasurement {
	if (entry.measurementMode !== 'jitless') return { measurementMode: 'legacy', runtime: null };

	const node = entry.nodeVersion ?? 'unknown';
	const v8 = entry.v8Version ?? 'unknown';
	return {
		measurementMode: 'jitless',
		runtime: { key: `${node}|${v8}`, label: `Node ${node} · V8 ${v8}` },
	};
}

/** Prefer deterministic measurements as soon as there is a recorded release. */
export function getPreferredCoverageMode(
	points: { measurementMode: CoverageMeasurementMode }[]
): CoverageMeasurementMode {
	return points.some(point => point.measurementMode === 'jitless') ? 'jitless' : 'legacy';
}

/** Return deterministic runtimes newest first without depending on benchmark manifest order. */
export function getCoverageRuntimes(points: CoverageMeasurement[]): CoverageRuntime[] {
	const runtimes = new Map<string, CoverageRuntime>();
	for (const point of points) {
		if (point.runtime) runtimes.set(point.runtime.key, point.runtime);
	}
	return [...runtimes.values()].sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }));
}

/** Select a single comparable series before assigning release indexes or aggregating counts. */
export function selectCoverageSeries<T extends CoverageMeasurement>(
	points: T[],
	mode: CoverageMeasurementMode,
	runtimeKey?: string
): T[] {
	if (mode === 'legacy') return points.filter(point => point.measurementMode === 'legacy');

	const selected = runtimeKey ?? getCoverageRuntimes(points)[0]?.key;
	return points.filter(point => point.measurementMode === 'jitless' && point.runtime?.key === selected);
}
