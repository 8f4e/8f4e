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

type TsdocCoverageEntry = {
	commit: string;
	recordedAt: string;
	coverage: {
		documented: number;
		total: number;
		percentage: number;
		byKind: Record<
			string,
			{
				documented: number;
				total: number;
				percentage: number;
			}
		>;
	};
};

type TsdocCoveragePoint = {
	packageName: string;
	label: string;
	recordedAt: Date;
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	documented: number;
	total: number;
	percentage: number;
};

export const tsdocMarkup = `
<div id="tsdoc-view" hidden>
	<section class="summary-grid" id="tsdoc-summary-grid" aria-label="Latest TSDoc coverage summary"></section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Coverage</h2>
			<span>TSDoc coverage percentage</span>
		</div>
		<div class="chart" id="tsdoc-overview-chart"></div>
	</section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Packages</h2>
			<span>Documented entities</span>
		</div>
		<div class="package-grid" id="tsdoc-grid"></div>
	</section>
</div>
`;

export function createTsdocReport(lastUpdated: HTMLParagraphElement) {
	const view = requireElement<HTMLDivElement>('#tsdoc-view');
	const summaryGrid = requireElement<HTMLDivElement>('#tsdoc-summary-grid', view);
	const overviewChart = requireElement<HTMLDivElement>('#tsdoc-overview-chart', view);
	const grid = requireElement<HTMLDivElement>('#tsdoc-grid', view);
	let data: ReportData<PackageLog, TsdocCoveragePoint> = { logs: [], points: [] };

	return {
		view,
		async load() {
			data = await loadReportData('tsdoc-coverage', 'TSDoc coverage', toTsdocPoints, withRecordedReleaseIndexes);
		},
		render() {
			const latestReleasePoints = getLatestReleasePoints(data.points);
			const latestPoint = latestReleasePoints[0] ?? null;
			const latestCoverage = summarizeTsdocCoverage(latestReleasePoints);
			const snapshotCount = new Set(data.points.map(point => point.releaseKey)).size;

			lastUpdated.textContent = latestPoint
				? `Latest TSDoc coverage ${latestPoint.releaseLabel} · ${formatDateTime(latestPoint.recordedAt)}`
				: 'No TSDoc coverage data';

			summaryGrid.innerHTML = [
				renderSummaryItem(
					'Overall Coverage',
					latestCoverage ? formatPercent(latestCoverage.percentage) : 'n/a',
					latestCoverage
						? `${formatCount(latestCoverage.documented)} / ${formatCount(latestCoverage.total)} documented`
						: ''
				),
				renderSummaryItem('Packages', String(latestReleasePoints.length), 'tracked packages'),
				renderSummaryItem('Snapshots', String(snapshotCount), 'recorded commits'),
			].join('');

			renderTsdocOverview(overviewChart, data.points);
			renderReportCards(grid, data.logs, {
				selectPoints: log => data.points.filter(point => point.packageName === log.packageName),
				summary: points => {
					const latest = points.at(-1);
					return {
						meta: latest ? formatTsdocPointMeta(latest) : '',
						value: latest ? formatPercent(latest.percentage) : 'n/a',
					};
				},
				renderTable: renderTsdocTable,
				chart: createTsdocPackageChart,
			});
		},
	};
}

function toTsdocPoints(log: PackageLog, entries: TsdocCoverageEntry[]) {
	return entries.map(entry => ({
		packageName: log.packageName,
		label: log.label,
		recordedAt: new Date(entry.recordedAt),
		commit: entry.commit,
		releaseKey: entry.commit || entry.recordedAt,
		releaseIndex: 0,
		releaseLabel: '',
		documented: entry.coverage.documented,
		total: entry.coverage.total,
		percentage: entry.coverage.percentage,
	}));
}

function renderTsdocOverview(overviewChart: HTMLElement, points: TsdocCoveragePoint[]) {
	const summaryPoints = toTsdocSummaryPoints(points);
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
			x: {
				label: null,
				grid: true,
				tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
			},
			y: {
				domain: [0, 100],
				label: 'Coverage',
				grid: true,
				tickFormat: value => `${value}%`,
			},
			marks: [
				...(hasTrend
					? [
							Plot.lineY(summaryPoints, {
								x: 'releaseIndex',
								y: 'percentage',
								stroke: '#1d4ed8',
								strokeWidth: 2.25,
								tip: true,
							}),
						]
					: []),
				Plot.dot(summaryPoints, {
					x: 'releaseIndex',
					y: 'percentage',
					fill: '#1d4ed8',
					r: 4,
					title: point =>
						`${point.releaseLabel}\n${formatPercent(point.percentage)}\n${formatCount(point.documented)} / ${formatCount(point.total)} documented`,
				}),
			],
		})
	);
}

function createTsdocPackageChart(container: HTMLElement, points: TsdocCoveragePoint[]) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	return Plot.plot({
		width: getChartWidth(container),
		height: 170,
		marginLeft: 46,
		marginRight: 16,
		marginTop: 12,
		marginBottom: 36,
		x: {
			label: null,
			grid: true,
			tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
		},
		y: {
			domain: [0, 100],
			label: 'Coverage',
			grid: true,
			tickFormat: value => `${value}%`,
		},
		marks: [
			...(hasTrend
				? [
						Plot.lineY(points, {
							x: 'releaseIndex',
							y: 'percentage',
							stroke: '#1d4ed8',
							strokeWidth: 2,
						}),
					]
				: []),
			Plot.dot(points, {
				x: 'releaseIndex',
				y: 'percentage',
				fill: '#1d4ed8',
				r: 4,
				title: point =>
					`${point.releaseLabel}\n${formatPercent(point.percentage)}\n${formatCount(point.documented)} / ${formatCount(point.total)} documented`,
			}),
		],
	});
}

function renderTsdocTable(points: TsdocCoveragePoint[]) {
	if (points.length === 0) {
		return '<div class="empty-table">No snapshots</div>';
	}

	return `
		<div class="file-table-wrap">
			<table class="file-table">
				<thead>
					<tr>
						<th>Snapshot</th>
						<th>Coverage</th>
						<th>Documented</th>
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
									<td>${formatPercent(point.percentage)}</td>
									<td>${formatCount(point.documented)} / ${formatCount(point.total)}</td>
								</tr>
							`
						)
						.join('')}
				</tbody>
			</table>
		</div>
	`;
}

function toTsdocSummaryPoints(points: TsdocCoveragePoint[]) {
	const byRelease = new Map<
		string,
		{
			commit: string;
			releaseKey: string;
			releaseIndex: number;
			releaseLabel: string;
			documented: number;
			total: number;
			percentage: number;
		}
	>();

	for (const point of points) {
		const existingPoint = byRelease.get(point.releaseKey);

		if (existingPoint) {
			existingPoint.documented += point.documented;
			existingPoint.total += point.total;
			existingPoint.percentage = getCoveragePercentage(existingPoint.documented, existingPoint.total);
			continue;
		}

		byRelease.set(point.releaseKey, {
			commit: point.commit,
			releaseKey: point.releaseKey,
			releaseIndex: point.releaseIndex,
			releaseLabel: point.releaseLabel,
			documented: point.documented,
			total: point.total,
			percentage: getCoveragePercentage(point.documented, point.total),
		});
	}

	return [...byRelease.values()];
}

function summarizeTsdocCoverage(points: TsdocCoveragePoint[]) {
	if (points.length === 0) {
		return null;
	}

	const documented = points.reduce((sum, point) => sum + point.documented, 0);
	const total = points.reduce((sum, point) => sum + point.total, 0);

	return {
		documented,
		total,
		percentage: getCoveragePercentage(documented, total),
	};
}

function formatTsdocPointMeta(point: TsdocCoveragePoint) {
	return `${point.releaseLabel} · ${formatCount(point.documented)} / ${formatCount(point.total)} documented`;
}
