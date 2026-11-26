import { describe, expect, it } from 'vitest';
import {
	getCoverageMeasurement,
	getCoverageRuntimes,
	getPreferredCoverageMode,
	selectCoverageSeries,
} from './coverage-series';

describe('compiler coverage series', () => {
	it('classifies historic entries and separates the deterministic series even for the same release', () => {
		const entries = [
			{ version: '14.1.5', commit: 'abc', rangeExecutions: 100 },
			{
				version: '14.1.5',
				commit: 'abc',
				rangeExecutions: 120,
				measurementMode: 'jitless',
				nodeVersion: 'v22.0.0',
				v8Version: '12.4.254.14',
			},
			{
				version: '14.1.5',
				commit: 'abc',
				rangeExecutions: 130,
				measurementMode: 'jitless',
				nodeVersion: 'v24.16.0',
				v8Version: '13.6.233.17',
			},
			{
				version: '14.1.6',
				commit: 'def',
				rangeExecutions: 110,
				measurementMode: 'jitless',
				nodeVersion: 'v24.16.0',
				v8Version: '13.6.233.17',
			},
		];
		const points = entries.map(entry => ({ ...entry, ...getCoverageMeasurement(entry) }));
		expect(getPreferredCoverageMode(points)).toBe('jitless');
		const [newRuntime, oldRuntime] = getCoverageRuntimes(points);
		expect(newRuntime.label).toBe('Node v24.16.0 · V8 13.6.233.17');
		expect(oldRuntime.label).toBe('Node v22.0.0 · V8 12.4.254.14');
		expect(selectCoverageSeries(points, 'legacy').map(point => point.rangeExecutions)).toEqual([100]);
		expect(selectCoverageSeries(points, 'jitless').map(point => point.rangeExecutions)).toEqual([130, 110]);
		expect(selectCoverageSeries(points, 'jitless', oldRuntime.key).map(point => point.rangeExecutions)).toEqual([120]);
		expect(selectCoverageSeries(points, 'jitless', newRuntime.key).map(point => point.rangeExecutions)).toEqual([
			130, 110,
		]);
	});

	it('defaults to historical data until deterministic logs are recorded', () => {
		expect(getPreferredCoverageMode([{ measurementMode: 'legacy' }])).toBe('legacy');
		expect(getPreferredCoverageMode([])).toBe('legacy');
	});
});
