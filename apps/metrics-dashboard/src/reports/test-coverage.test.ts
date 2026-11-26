import { expect, it } from 'vitest';
import { getLatestReleasePoints, withRecordedReleaseIndexes } from '../shared/data';
import { toTestPoints, toTestSummaryPoints } from './test-coverage';

function coverage(covered: number, total: number) {
	const bucket = { covered, total, percentage: (covered / total) * 100 };
	return { lines: bucket, statements: bucket, branches: bucket, functions: bucket };
}

it('does not combine test coverage snapshots measured with different source scopes', () => {
	const legacy = { commit: 'abc', recordedAt: '2026-01-01T00:00:00Z', coverage: coverage(4, 4) };
	const current = {
		commit: 'abc',
		recordedAt: '2026-01-02T00:00:00Z',
		measurementScope: 'production-source',
		coverage: coverage(4, 8),
	};
	const points = withRecordedReleaseIndexes([
		...toTestPoints({ packageName: 'a', label: 'a', path: 'a.json' }, [legacy, current]),
		...toTestPoints({ packageName: 'b', label: 'b', path: 'b.json' }, [current]),
	]);
	const summaries = toTestSummaryPoints(points, 'lines');
	expect(summaries.map(({ scope, covered, total }) => ({ scope, covered, total }))).toEqual([
		{ scope: 'Historical scope', covered: 4, total: 4 },
		{ scope: 'Production source', covered: 8, total: 16 },
	]);
	expect(getLatestReleasePoints(points).map(point => point.scope)).toEqual(['Production source', 'Production source']);
});
