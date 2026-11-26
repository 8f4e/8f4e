export type CoverageMeasurementMode = 'legacy' | 'jitless';

/** Historical rows have no mode; never combine them with measurements made with JIT disabled. */
export function getCoverageMeasurementMode(entry: { measurementMode?: string }): CoverageMeasurementMode {
	return entry.measurementMode === 'jitless' ? 'jitless' : 'legacy';
}

/** Prefer deterministic measurements as soon as there is a recorded release. */
export function getPreferredCoverageMode(
	points: { measurementMode: CoverageMeasurementMode }[]
): CoverageMeasurementMode {
	return points.some(point => point.measurementMode === 'jitless') ? 'jitless' : 'legacy';
}

/** Select a single comparable series before assigning release indexes or aggregating counts. */
export function selectCoverageSeries<T extends { measurementMode: CoverageMeasurementMode }>(
	points: T[],
	mode: CoverageMeasurementMode
): T[] {
	return points.filter(point => point.measurementMode === mode);
}
