import * as Plot from '@observablehq/plot';
import { getByteDomain, getChartWidth, getReleaseLabels, hasMultipleSnapshots, replaceChart } from '../shared/charts';
import {
	type BenchmarkLog,
	getLatestReleasePoints,
	loadReportData,
	type ReportData,
	withSequentialReleaseIndexes,
} from '../shared/data';
import { escapeHtml, renderReportCards, renderSummaryItem, requireElement } from '../shared/dom';
import { formatBytes, formatCompactBytes, formatReleaseMeta, shortCommit } from '../shared/format';

type BytecodeSizeEntry = {
	commit: string;
	version: string | null;
	benchmark: string;
	emittedBytes: number;
};

type BytecodePoint = {
	benchmark: string;
	label: string;
	version: string;
	releaseTag: string;
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	bytes: number;
};

export const bytecodeMarkup = `
<div id="bytecode-view" hidden>
	<section class="summary-grid" id="bytecode-summary-grid" aria-label="Latest bytecode size summary"></section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Benchmarks</h2>
			<span id="bytecode-package-caption">Emitted bytes</span>
		</div>
		<div class="package-grid" id="bytecode-grid"></div>
	</section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Growth</h2>
			<span>Emitted bytes</span>
		</div>
		<div class="chart" id="bytecode-overview-chart"></div>
	</section>
</div>
`;

export function createBytecodeReport(lastUpdated: HTMLParagraphElement) {
	const view = requireElement<HTMLDivElement>('#bytecode-view');
	const summaryGrid = requireElement<HTMLDivElement>('#bytecode-summary-grid', view);
	const overviewChart = requireElement<HTMLDivElement>('#bytecode-overview-chart', view);
	const grid = requireElement<HTMLDivElement>('#bytecode-grid', view);
	let data: ReportData<BenchmarkLog, BytecodePoint> = { logs: [], points: [] };

	return {
		view,
		async load() {
			data = await loadReportData('bytecode-size', 'bytecode size', toBytecodePoints, withSequentialReleaseIndexes);
		},
		render() {
			const latestReleasePoints = getLatestReleasePoints(data.points);
			const latestPoint = latestReleasePoints[0] ?? null;
			const latestReleaseBytes = latestReleasePoints.reduce((sum, point) => sum + point.bytes, 0);
			const snapshotCount = new Set(data.points.map(point => point.releaseKey)).size;

			lastUpdated.textContent = latestPoint
				? `Latest compiler ${latestPoint.releaseTag} · ${shortCommit(latestPoint.commit)}`
				: 'No bytecode data';

			summaryGrid.innerHTML = [
				renderSummaryItem(
					'Latest Compiler',
					latestPoint?.version ?? 'n/a',
					latestPoint ? shortCommit(latestPoint.commit) : ''
				),
				renderSummaryItem(
					'Latest Size',
					latestPoint ? formatBytes(latestReleaseBytes) : 'n/a',
					`${latestReleasePoints.length} benchmarks`
				),
				renderSummaryItem('Snapshots', String(snapshotCount), 'compiler releases'),
			].join('');

			renderBytecodeOverview(overviewChart, data.points);
			renderReportCards(grid, data.logs, {
				selectPoints: log => data.points.filter(point => point.benchmark === log.benchmark),
				summary: points => {
					const latest = points.at(-1);
					return { meta: latest ? formatReleaseMeta(latest) : '', value: latest ? formatBytes(latest.bytes) : 'n/a' };
				},
				renderTable: renderBytecodeTable,
				chart: createBytecodeBenchmarkChart,
			});
		},
	};
}

function toBytecodePoints(log: BenchmarkLog, entries: BytecodeSizeEntry[]) {
	return entries.map(entry => {
		const bytes = entry.emittedBytes;
		const version = entry.version ?? 'unknown';
		return {
			benchmark: log.benchmark,
			label: log.label,
			version,
			releaseTag: `@8f4e/compiler@${version}`,
			commit: entry.commit,
			releaseKey: entry.commit || version,
			releaseIndex: 0,
			releaseLabel: '',
			bytes,
		};
	});
}

function renderBytecodeOverview(overviewChart: HTMLElement, points: BytecodePoint[]) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	replaceChart(
		overviewChart,
		Plot.plot({
			width: getChartWidth(overviewChart),
			height: 340,
			marginLeft: 64,
			marginRight: 24,
			marginTop: 18,
			marginBottom: 44,
			x: {
				label: null,
				grid: true,
				tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
			},
			y: {
				domain: getByteDomain(points),
				label: 'Emitted bytes',
				grid: true,
				tickFormat: formatCompactBytes,
			},
			color: { legend: true },
			marks: [
				...(hasTrend
					? [
							Plot.lineY(points, {
								x: 'releaseIndex',
								y: 'bytes',
								stroke: 'label',
								strokeWidth: 2.25,
								tip: true,
							}),
						]
					: []),
				Plot.dot(points, {
					x: 'releaseIndex',
					y: 'bytes',
					fill: 'label',
					r: 4,
					title: point => `${point.label}\n${point.releaseTag}\n${point.releaseLabel}\n${formatBytes(point.bytes)}`,
				}),
			],
		})
	);
}

function createBytecodeBenchmarkChart(container: HTMLElement, points: BytecodePoint[]) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	return Plot.plot({
		width: getChartWidth(container),
		height: 170,
		marginLeft: 54,
		marginRight: 16,
		marginTop: 12,
		marginBottom: 36,
		x: {
			label: null,
			grid: true,
			tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
		},
		y: {
			domain: getByteDomain(points),
			label: 'Bytes',
			grid: true,
			tickFormat: formatCompactBytes,
		},
		marks: [
			...(hasTrend
				? [
						Plot.lineY(points, {
							x: 'releaseIndex',
							y: 'bytes',
							stroke: '#1d4ed8',
							strokeWidth: 2,
						}),
					]
				: []),
			Plot.dot(points, {
				x: 'releaseIndex',
				y: 'bytes',
				fill: '#1d4ed8',
				r: 4,
				title: point => `${point.releaseTag}\n${point.releaseLabel}\n${formatBytes(point.bytes)}`,
			}),
		],
	});
}

function renderBytecodeTable(points: BytecodePoint[]) {
	if (points.length === 0) {
		return '<div class="empty-table">No snapshots</div>';
	}

	return `
		<div class="file-table-wrap">
			<table class="file-table">
				<thead>
					<tr>
						<th>Compiler</th>
						<th>Bytes</th>
					</tr>
				</thead>
				<tbody>
					${points
						.slice(-8)
						.reverse()
						.map(
							point => `
								<tr>
									<td>${escapeHtml(point.releaseTag)}</td>
									<td>${formatBytes(point.bytes)}</td>
								</tr>
							`
						)
						.join('')}
				</tbody>
			</table>
		</div>
	`;
}
