import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getCoveragePercentage,
	getLatestReleasePoints,
	loadReportData,
	withRecordedReleaseIndexes,
	withSequentialReleaseIndexes,
} from './data';

afterEach(() => vi.unstubAllGlobals());

describe('report data loading', () => {
	it('loads entries in manifest order and indexes the combined report', async () => {
		const logs = [
			{ path: 'b.json', label: 'B' },
			{ path: 'a.json', label: 'A' },
		];
		const fetchMock = vi.fn(async (url: string) => {
			if (url.endsWith('manifest.json')) return Response.json({ logs });
			return Response.json(url.endsWith('b.json') ? [2, 3] : [1]);
		});
		vi.stubGlobal('fetch', fetchMock);
		const report = await loadReportData(
			'metrics',
			'sample',
			(log: (typeof logs)[number], entries: number[]) => entries.map(value => ({ label: log.label, value })),
			points => points.map((point, index) => ({ ...point, index }))
		);
		expect(report.logs).toEqual(logs);
		expect(report.points).toEqual([
			{ label: 'B', value: 2, index: 0 },
			{ label: 'B', value: 3, index: 1 },
			{ label: 'A', value: 1, index: 2 },
		]);
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'metrics/manifest.json',
			'metrics/b.json',
			'metrics/a.json',
		]);
		expect(fetchMock).toHaveBeenCalledWith('metrics/manifest.json', { cache: 'no-store' });
	});

	it('identifies the failed manifest or log in errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 404 }))
		);
		await expect(loadReportData('metrics', 'sample', () => [])).rejects.toThrow('Failed to load sample manifest: 404');
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('manifest.json')
					? Response.json({ logs: [{ path: 'broken.json' }] })
					: new Response(null, { status: 500 })
			)
		);
		await expect(loadReportData('metrics', 'sample', () => [])).rejects.toThrow('Failed to load broken.json: 500');
	});
});

describe('release indexing', () => {
	it('keeps compiler releases in recorded sequence and groups duplicate commits', () => {
		const points = [
			{ releaseKey: 'first', commit: 'first', version: '1.0.0' },
			{ releaseKey: 'second', commit: 'second', version: '1.1.0' },
			{ releaseKey: 'first', commit: 'first', version: '1.0.0' },
		];
		const indexed = withSequentialReleaseIndexes(points);
		expect(indexed.map(point => point.releaseLabel)).toEqual(['1 · 1.0.0', '2 · 1.1.0', '1 · 1.0.0']);
		expect(getLatestReleasePoints(indexed)).toEqual([indexed[1]]);
	});

	it('orders coverage snapshots by recording date and shares an index across packages', () => {
		const later = { releaseKey: 'commit2', commit: 'commit2', recordedAt: new Date('2026-01-02') };
		const earlier = { releaseKey: 'commit1', commit: 'commit1', recordedAt: new Date('2026-01-01') };
		const indexed = withRecordedReleaseIndexes([later, earlier, later]);
		expect(indexed.map(point => point.releaseLabel)).toEqual(['2 · commit2', '1 · commit1', '2 · commit2']);
		expect(getLatestReleasePoints(indexed)).toEqual([indexed[0], indexed[2]]);
		expect(getLatestReleasePoints([])).toEqual([]);
		expect(getCoveragePercentage(1, 3)).toBe(33.3);
		expect(getCoveragePercentage(0, 0)).toBe(100);
	});
});
