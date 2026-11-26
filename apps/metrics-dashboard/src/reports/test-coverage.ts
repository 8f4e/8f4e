import * as Plot from '@observablehq/plot';
import { getChartWidth, getReleaseLabels, hasMultipleSnapshots, replaceChart } from '../shared/charts';
import {
	getCoveragePercentage,
	getLatestReleasePoints,
	loadReportData,
	type PackageLog,
	type ReportData,
	withRecordedReleaseIndexes,
} from '../shared/data';
import { escapeHtml, renderReportCards, renderSummaryItem, requireElement } from '../shared/dom';
import { formatCount, formatDateTime, formatPercent } from '../shared/format';

type TestCoverageMetric = 'statements' | 'branches' | 'functions' | 'lines';
type TestCoverageScope = 'Historical scope' | 'Production source';

const scopeColors = {
	domain: ['Historical scope', 'Production source'],
	range: ['#1d4ed8', '#0f766e'],
};

type TestCoverageBucket = {
	covered: number;
	total: number;
	percentage: number;
};

type TestCoverageEntry = {
	commit: string;
	recordedAt: string;
	measurementScope?: string;
	coverage: Record<TestCoverageMetric, TestCoverageBucket>;
};

type TestCoveragePoint = {
	packageName: string;
	label: string;
	recordedAt: Date;
	commit: string;
	scope: TestCoverageScope;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	coverage: Record<TestCoverageMetric, TestCoverageBucket>;
};

type TestCoverageSummaryPoint = {
	commit: string;
	scope: TestCoverageScope;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	covered: number;
	total: number;
	percentage: number;
};

export const testsMarkup = `
<div id="tests-view" hidden>
	<section class="summary-grid" id="tests-summary-grid" aria-label="Latest test coverage summary"></section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Coverage</h2>
			<span>Line coverage percentage · separate measurement scopes</span>
		</div>
		<div class="chart" id="tests-overview-chart"></div>
	</section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Packages</h2>
			<span>Covered lines</span>
		</div>
		<div class="package-grid" id="tests-grid"></div>
	</section>
</div>
`;

export function createTestReport(lastUpdated: HTMLParagraphElement) {
	const view = requireElement<HTMLDivElement>('#tests-view');
	const summaryGrid = requireElement<HTMLDivElement>('#tests-summary-grid', view);
	const overviewChart = requireElement<HTMLDivElement>('#tests-overview-chart', view);
	const grid = requireElement<HTMLDivElement>('#tests-grid', view);
	let data: ReportData<PackageLog, TestCoveragePoint> = { logs: [], points: [] };

	return {
		view,
		async load() {
			data = await loadReportData('test-coverage', 'test coverage', toTestPoints, withRecordedReleaseIndexes);
		},
		render() {
			const latestReleasePoints = getLatestReleasePoints(data.points);
			const latestPoint = latestReleasePoints[0] ?? null;
			const latestCoverage = summarizeTestCoverage(latestReleasePoints, 'lines');
			const snapshotCount = new Set(data.points.map(point => point.releaseKey)).size;

			lastUpdated.textContent = latestPoint
				? `Latest test coverage ${latestPoint.releaseLabel} · ${latestPoint.scope} · ${formatDateTime(latestPoint.recordedAt)}`
				: 'No test coverage data';

			summaryGrid.innerHTML = [
				renderSummaryItem(
					'Line Coverage',
					latestCoverage ? formatPercent(latestCoverage.percentage) : 'n/a',
					latestCoverage ? `${formatCount(latestCoverage.covered)} / ${formatCount(latestCoverage.total)} covered` : ''
				),
				renderSummaryItem('Packages', String(latestReleasePoints.length), 'tracked packages'),
				renderSummaryItem('Snapshots', String(snapshotCount), 'recorded measurements'),
			].join('');

			renderTestOverview(overviewChart, data.points);
			renderReportCards(grid, data.logs, {
				selectPoints: log => data.points.filter(point => point.packageName === log.packageName),
				summary: points => {
					const latest = points.at(-1);
					return {
						meta: latest ? formatTestPointMeta(latest) : '',
						value: latest ? formatPercent(latest.coverage.lines.percentage) : 'n/a',
					};
				},
				renderTable: renderTestTable,
				chart: createTestPackageChart,
			});
		},
	};
}

/** Keep legacy and full-source snapshots separate even if they refer to the same commit. */
export function toTestPoints(log: PackageLog, entries: TestCoverageEntry[]): TestCoveragePoint[] {
	return entries.map(entry => {
		const scope: TestCoverageScope =
			entry.measurementScope === 'production-source' ? 'Production source' : 'Historical scope';
		return {
			packageName: log.packageName,
			label: log.label,
			recordedAt: new Date(entry.recordedAt),
			commit: entry.commit,
			scope,
			releaseKey: `${entry.commit || entry.recordedAt}|${scope}`,
			releaseIndex: 0,
			releaseLabel: '',
			coverage: entry.coverage,
		};
	});
}

function renderTestOverview(overviewChart: HTMLElement, points: TestCoveragePoint[]) {
	const summaryPoints = toTestSummaryPoints(points, 'lines');
	const releaseLabels = getReleaseLabels(summaryPoints);
	const hasTrend = hasMultipleSnapshots(summaryPoints);

	replaceChart(
		overviewChart,
		Plot.plot({
			width: getChartWidth(overviewChart),
			height: 340,
			marginLeft: 56,
			marginRight: 24,
			marginTop: 18,
			marginBottom: 44,
			color: { ...scopeColors, legend: new Set(summaryPoints.map(point => point.scope)).size > 1 },
			x: {
				label: null,
				grid: true,
				tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
			},
			y: {
				domain: [0, 100],
				label: 'Line coverage',
				grid: true,
				tickFormat: value => `${value}%`,
			},
			marks: [
				...(hasTrend
					? [
							Plot.lineY(summaryPoints, {
								x: 'releaseIndex',
								y: 'percentage',
								stroke: 'scope',
								z: 'scope',
								strokeWidth: 2.25,
								tip: true,
							}),
						]
					: []),
				Plot.dot(summaryPoints, {
					x: 'releaseIndex',
					y: 'percentage',
					fill: 'scope',
					r: 4,
					title: point =>
						`${point.releaseLabel}\n${point.scope}\n${formatPercent(point.percentage)}\n${formatCount(point.covered)} / ${formatCount(point.total)} lines covered`,
				}),
			],
		})
	);
}

function createTestPackageChart(container: HTMLElement, points: TestCoveragePoint[]) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	return Plot.plot({
		width: getChartWidth(container),
		height: 170,
		marginLeft: 46,
		marginRight: 16,
		marginTop: 12,
		marginBottom: 36,
		color: scopeColors,
		x: {
			label: null,
			grid: true,
			tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
		},
		y: {
			domain: [0, 100],
			label: 'Lines',
			grid: true,
			tickFormat: value => `${value}%`,
		},
		marks: [
			...(hasTrend
				? [
						Plot.lineY(points, {
							x: 'releaseIndex',
							y: point => point.coverage.lines.percentage,
							stroke: 'scope',
							z: 'scope',
							strokeWidth: 2,
						}),
					]
				: []),
			Plot.dot(points, {
				x: 'releaseIndex',
				y: point => point.coverage.lines.percentage,
				fill: 'scope',
				r: 4,
				title: point =>
					`${point.releaseLabel}\n${point.scope}\n${formatPercent(point.coverage.lines.percentage)}\n${formatCount(point.coverage.lines.covered)} / ${formatCount(point.coverage.lines.total)} lines covered`,
			}),
		],
	});
}

function renderTestTable(points: TestCoveragePoint[]) {
	if (points.length === 0) {
		return '<div class="empty-table">No snapshots</div>';
	}

	return `
		<div class="file-table-wrap">
			<table class="file-table">
				<thead>
					<tr>
						<th>Snapshot</th>
						<th>Scope</th>
						<th>Lines</th>
						<th>Branches</th>
						<th>Functions</th>
					</tr>
				</thead>
				<tbody>
					${points
						.slice(-8)
						.reverse()
						.map(
							point => `
								<tr>
									<td>${escapeHtml(point.releaseLabel)}</td>
									<td>${point.scope}</td>
									<td>${formatPercent(point.coverage.lines.percentage)}</td>
									<td>${formatPercent(point.coverage.branches.percentage)}</td>
									<td>${formatPercent(point.coverage.functions.percentage)}</td>
								</tr>
							`
						)
						.join('')}
				</tbody>
			</table>
		</div>
	`;
}

export function toTestSummaryPoints(
	points: TestCoveragePoint[],
	metric: TestCoverageMetric
): TestCoverageSummaryPoint[] {
	const byRelease = new Map<string, TestCoverageSummaryPoint>();

	for (const point of points) {
		const existingPoint = byRelease.get(point.releaseKey);
		const coverage = point.coverage[metric];

		if (existingPoint) {
			existingPoint.covered += coverage.covered;
			existingPoint.total += coverage.total;
			existingPoint.percentage = getCoveragePercentage(existingPoint.covered, existingPoint.total);
			continue;
		}

		byRelease.set(point.releaseKey, {
			commit: point.commit,
			scope: point.scope,
			releaseKey: point.releaseKey,
			releaseIndex: point.releaseIndex,
			releaseLabel: point.releaseLabel,
			covered: coverage.covered,
			total: coverage.total,
			percentage: getCoveragePercentage(coverage.covered, coverage.total),
		});
	}

	return [...byRelease.values()];
}

function summarizeTestCoverage(points: TestCoveragePoint[], metric: TestCoverageMetric) {
	if (points.length === 0) {
		return null;
	}

	const covered = points.reduce((sum, point) => sum + point.coverage[metric].covered, 0);
	const total = points.reduce((sum, point) => sum + point.coverage[metric].total, 0);

	return {
		covered,
		total,
		percentage: getCoveragePercentage(covered, total),
	};
}

function formatTestPointMeta(point: TestCoveragePoint) {
	return `${point.releaseLabel} · ${point.scope} · ${formatCount(point.coverage.lines.covered)} / ${formatCount(point.coverage.lines.total)} lines`;
}
