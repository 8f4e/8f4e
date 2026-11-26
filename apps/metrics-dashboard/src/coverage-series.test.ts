import { describe, expect, it } from 'vitest';
import { getCoverageMeasurementMode, getPreferredCoverageMode, selectCoverageSeries } from './coverage-series';

describe('compiler coverage series', () => {
	it('classifies historic entries and separates the deterministic series even for the same release', () => {
		const entries = [
			{ version: '14.1.5', commit: 'abc', rangeExecutions: 100 },
			{ version: '14.1.5', commit: 'abc', rangeExecutions: 120, measurementMode: 'jitless' },
			{ version: '14.1.6', commit: 'def', rangeExecutions: 110, measurementMode: 'jitless' },
		];
		const points = entries.map(entry => ({ ...entry, measurementMode: getCoverageMeasurementMode(entry) }));
		expect(getPreferredCoverageMode(points)).toBe('jitless');
		expect(selectCoverageSeries(points, 'legacy').map(point => point.rangeExecutions)).toEqual([100]);
		expect(selectCoverageSeries(points, 'jitless').map(point => point.rangeExecutions)).toEqual([120, 110]);
	});

	it('defaults to historical data until deterministic logs are recorded', () => {
		expect(getPreferredCoverageMode([{ measurementMode: 'legacy' }])).toBe('legacy');
		expect(getPreferredCoverageMode([])).toBe('legacy');
	});
});
