import * as Plot from '@observablehq/plot';
import { getByteDomain, getChartWidth, getReleaseLabels, hasMultipleSnapshots, replaceChart } from '../shared/charts';
import { loadReportData, type PackageLog, type ReportData } from '../shared/data';
import { renderReportCards, renderSummaryItem, requireElement } from '../shared/dom';
import { formatBytes, formatCompactBytes, formatDateTime, formatReleaseMeta, shortCommit } from '../shared/format';

export type SizeMetric = 'raw' | 'gzip';

type BundleSizeEntry = {
	schemaVersion: number;
	recordedAt: string;
	commit: string;
	branch: string;
	releaseTag: string | null;
	packageName: string;
	projectName: string;
	version: string | null;
	bytes: Record<SizeMetric, number>;
};

type BundlePoint = {
	packageName: string;
	label: string;
	recordedAt: Date;
	version: string;
	releaseTag: string;
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	metric: SizeMetric;
	bytes: number;
	raw: number;
	gzip: number;
};

export const bundlesMarkup = `
<div id="bundles-view">
	<section class="summary-grid" id="summary-grid" aria-label="Latest bundle size summary"></section>
	<section class="chart-section package-section">
		<div class="section-heading">
			<h2>Packages</h2>
			<span id="package-caption"></span>
		</div>
		<div class="package-grid" id="package-grid"></div>
	</section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Growth</h2>
			<span id="growth-caption"></span>
		</div>
		<div class="chart" id="overview-chart"></div>
	</section>
</div>
`;

export function createBundleReport(lastUpdated: HTMLParagraphElement) {
	const view = requireElement<HTMLDivElement>('#bundles-view');
	const summaryGrid = requireElement<HTMLDivElement>('#summary-grid', view);
	const overviewChart = requireElement<HTMLDivElement>('#overview-chart', view);
	const packageGrid = requireElement<HTMLDivElement>('#package-grid', view);
	const growthCaption = requireElement<HTMLSpanElement>('#growth-caption', view);
	const packageCaption = requireElement<HTMLSpanElement>('#package-caption', view);
	let data: ReportData<PackageLog, BundlePoint> = { logs: [], points: [] };

	return {
		view,
		async load() {
			data = await loadReportData('bundle-sizes', 'bundle size', toBundlePoints, withBundleReleaseIndexes);
		},
		render(metric: SizeMetric) {
			const metricPoints = data.points.filter(point => point.metric === metric);
			const latestPoints = getLatestPoints(data.logs, metricPoints);
			const latestDate = getLatestDate(latestPoints);

			lastUpdated.textContent = latestDate ? `Last recorded ${formatDateTime(latestDate)}` : 'No recorded data';
			growthCaption.textContent = metricLabel(metric);
			packageCaption.textContent = metricLabel(metric);

			renderSummary(summaryGrid, latestPoints, data.points);
			renderOverview(overviewChart, metricPoints, metric);
			renderReportCards(packageGrid, data.logs, {
				selectPoints: log => metricPoints.filter(point => point.packageName === log.packageName),
				summary: points => {
					const latest = points.at(-1);
					return { meta: latest ? formatReleaseMeta(latest) : '', value: latest ? formatBytes(latest.bytes) : 'n/a' };
				},
				chart: (container, points) => createPackageChart(container, points, metric),
			});
		},
	};
}

function toBundlePoints(log: PackageLog, entries: BundleSizeEntry[]) {
	const sortedEntries = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
	const points: BundlePoint[] = [];

	for (const entry of sortedEntries) {
		const bytes = entry.bytes;

		for (const metric of ['raw', 'gzip'] as const) {
			const metricBytes = bytes[metric];

			points.push({
				packageName: log.packageName,
				label: log.label,
				recordedAt: new Date(entry.recordedAt),
				version: entry.version ?? 'unknown',
				releaseTag: entry.releaseTag ?? `${entry.projectName}@${entry.version ?? 'unknown'}`,
				commit: entry.commit,
				releaseKey: entry.commit || entry.recordedAt,
				releaseIndex: 0,
				releaseLabel: '',
				metric,
				bytes: metricBytes,
				raw: bytes.raw,
				gzip: bytes.gzip,
			});
		}
	}

	return points;
}

function withBundleReleaseIndexes(points: BundlePoint[]) {
	const releaseDates = new Map<string, Date>();

	for (const point of points) {
		const currentDate = releaseDates.get(point.releaseKey);

		if (!currentDate || point.recordedAt < currentDate) {
			releaseDates.set(point.releaseKey, point.recordedAt);
		}
	}

	const releases = [...releaseDates.entries()]
		.sort(([, dateA], [, dateB]) => dateA.getTime() - dateB.getTime())
		.map(([key], index) => ({
			key,
			index,
			label: `${index + 1} · ${shortCommit(key)}`,
		}));
	const releaseByKey = new Map(releases.map(release => [release.key, release]));

	return points.map(point => {
		const release = releaseByKey.get(point.releaseKey);

		if (!release) {
			return point;
		}

		return {
			...point,
			releaseIndex: release.index,
			releaseLabel: release.label,
		};
	});
}

function renderSummary(summaryGrid: HTMLElement, latestPoints: BundlePoint[], allPoints: BundlePoint[]) {
	const websitePoint = latestPoints.find(point => point.packageName === '@8f4e/editor-webapp') ?? null;
	const totalTrackedBytes = latestPoints.reduce((sum, point) => sum + point.bytes, 0);
	const snapshotCount = new Set(allPoints.map(point => point.releaseKey)).size;

	summaryGrid.innerHTML = [
		renderSummaryItem(
			'Website',
			websitePoint ? formatBytes(websitePoint.bytes) : 'n/a',
			websitePoint ? formatReleaseMeta(websitePoint) : ''
		),
		renderSummaryItem('Tracked Total', formatBytes(totalTrackedBytes), `${latestPoints.length} packages`),
		renderSummaryItem('Snapshots', String(snapshotCount), 'release commits'),
	].join('');
}

function renderOverview(overviewChart: HTMLElement, points: BundlePoint[], metric: SizeMetric) {
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
				label: `${metricLabel(metric)} bytes`,
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

function createPackageChart(container: HTMLElement, points: BundlePoint[], metric: SizeMetric) {
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
			label: `${metricLabel(metric)} bytes`,
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

function getLatestPoints(logs: PackageLog[], points: BundlePoint[]) {
	return logs
		.map(log => points.filter(point => point.packageName === log.packageName).at(-1))
		.filter((point): point is BundlePoint => Boolean(point));
}

function getLatestDate(points: BundlePoint[]) {
	return points.map(point => point.recordedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function metricLabel(metric: SizeMetric) {
	return metric === 'raw' ? 'Raw' : 'Gzip';
}
