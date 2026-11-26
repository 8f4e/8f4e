import * as Plot from '@observablehq/plot';
import {
	type CoverageMeasurementMode,
	getCoverageMeasurementMode,
	getPreferredCoverageMode,
	selectCoverageSeries,
} from '../coverage-series';
import { getChartWidth, getCountDomain, getReleaseLabels, hasMultipleSnapshots, replaceChart } from '../shared/charts';
import {
	type BenchmarkLog,
	getLatestReleasePoints,
	loadReportData,
	type ReportData,
	withSequentialReleaseIndexes,
} from '../shared/data';
import { escapeHtml, renderReportCards, renderSummaryItem, requireElement } from '../shared/dom';
import { formatCompactCount, formatCount, formatReleaseMeta, shortCommit } from '../shared/format';

type CoverageComponent = string;

type CoverageMetric = 'rangeExecutions' | 'functionEntries' | 'coveredFunctions';

export type CoverageDashboardTab = 'ranges' | 'functionEntries' | 'coveredFunctions';

type CoverageMetricConfig = {
	metric: CoverageMetric;
	emptyLabel: string;
	axisLabel: string;
	cardLabel: string;
	pipelineSummaryLabel: string;
	compilerSummaryLabel: string;
	tokenizerSummaryLabel: string;
};

const coverageMetricConfigs: Record<CoverageDashboardTab, CoverageMetricConfig> = {
	ranges: {
		metric: 'rangeExecutions',
		emptyLabel: 'range execution data',
		axisLabel: 'Range executions',
		cardLabel: 'Ranges',
		pipelineSummaryLabel: 'Pipeline Ranges',
		compilerSummaryLabel: 'Compiler Core Ranges',
		tokenizerSummaryLabel: 'Tokenizer Ranges',
	},
	functionEntries: {
		metric: 'functionEntries',
		emptyLabel: 'function entry data',
		axisLabel: 'Function entries',
		cardLabel: 'Entries',
		pipelineSummaryLabel: 'Pipeline Entries',
		compilerSummaryLabel: 'Compiler Core Entries',
		tokenizerSummaryLabel: 'Tokenizer Entries',
	},
	coveredFunctions: {
		metric: 'coveredFunctions',
		emptyLabel: 'covered function data',
		axisLabel: 'Covered functions',
		cardLabel: 'Functions',
		pipelineSummaryLabel: 'Pipeline Functions',
		compilerSummaryLabel: 'Compiler Core Functions',
		tokenizerSummaryLabel: 'Tokenizer Functions',
	},
};

const coverageComponentOrder = [
	'compilerPipeline',
	'compiler',
	'tokenizer',
	'constantResolver',
	'memoryPlanner',
	'memoryReferenceResolver',
	'memoryDefaultResolver',
	'semanticReferenceResolver',
	'semanticUtils',
	'stackAnalyzer',
	'wasmCodegen',
	'compilerWasmUtils',
	'languageSpec',
];

const coverageComponentLabels: Record<CoverageComponent, string> = {
	compilerPipeline: 'Compiler Pipeline',
	compiler: 'Compiler Core',
	tokenizer: 'Tokenizer',
	constantResolver: 'Constant Resolver',
	memoryPlanner: 'Memory Planner',
	memoryReferenceResolver: 'Memory Reference Resolver',
	memoryDefaultResolver: 'Memory Default Resolver',
	semanticReferenceResolver: 'Semantic Reference Resolver',
	semanticUtils: 'Semantic Utils',
	stackAnalyzer: 'Stack Analyzer',
	wasmCodegen: 'Wasm Codegen',
	compilerWasmUtils: 'Compiler Wasm Utils',
	languageSpec: 'Language Spec',
};

type CompilerCoverageBucket = {
	coveredFunctions: number;
	functionEntries: number;
	rangeExecutions: number;
	maxRangesPerFunction: number;
};

type CompilerCoverageEntry = {
	schemaVersion?: number;
	measurementMode?: string;
	commit: string;
	version: string | null;
	benchmark: string;
	coverage: Partial<Record<CoverageComponent, CompilerCoverageBucket>>;
};

type CoveragePoint = {
	measurementMode: CoverageMeasurementMode;
	benchmark: string;
	label: string;
	component: CoverageComponent;
	componentLabel: string;
	seriesLabel: string;
	version: string;
	releaseTag: string;
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	coveredFunctions: number;
	functionEntries: number;
	rangeExecutions: number;
};

type CoverageSummaryPoint = {
	component: CoverageComponent;
	componentLabel: string;
	version: string;
	releaseTag: string;
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	value: number;
};

export const coverageMarkup = `
<div id="ranges-view" hidden>
	<section class="summary-grid" id="ranges-summary-grid" aria-label="Latest compiler coverage summary"></section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Compiler vs Tokenizer</h2>
			<span id="coverage-overview-caption">Range executions</span>
		</div>
		<div class="chart" id="ranges-overview-chart"></div>
	</section>
	<section class="chart-section">
		<div class="section-heading">
			<h2>Benchmarks</h2>
			<span id="coverage-benchmark-caption">Compiler and tokenizer</span>
		</div>
		<div class="package-grid" id="ranges-grid"></div>
	</section>
</div>
`;

export function isCoverageDashboardTab(tab: string): tab is CoverageDashboardTab {
	return tab in coverageMetricConfigs;
}

export function createCoverageReport(lastUpdated: HTMLParagraphElement) {
	const view = requireElement<HTMLDivElement>('#ranges-view');
	const summaryGrid = requireElement<HTMLDivElement>('#ranges-summary-grid', view);
	const overviewChart = requireElement<HTMLDivElement>('#ranges-overview-chart', view);
	const grid = requireElement<HTMLDivElement>('#ranges-grid', view);
	const coverageOverviewCaption = requireElement<HTMLSpanElement>('#coverage-overview-caption', view);
	const coverageBenchmarkCaption = requireElement<HTMLSpanElement>('#coverage-benchmark-caption', view);
	let data: ReportData<BenchmarkLog, CoveragePoint> = { logs: [], points: [] };

	return {
		view,
		async load() {
			data = await loadReportData('compiler-coverage-counts', 'compiler coverage count', toCoveragePoints);
		},
		preferredMode() {
			return getPreferredCoverageMode(data.points);
		},
		render(tab: CoverageDashboardTab, mode: CoverageMeasurementMode) {
			const config = coverageMetricConfigs[tab];
			const coveragePoints = withSequentialReleaseIndexes(selectCoverageSeries(data.points, mode));
			const summaryPoints = toCoverageSummaryPoints(coveragePoints, config.metric);
			const latestReleasePoints = getLatestReleasePoints(summaryPoints);
			const latestPoint = latestReleasePoints[0] ?? null;
			const latestPipelinePoint = latestReleasePoints.find(point => point.component === 'compilerPipeline') ?? null;
			const latestCompilerPoint = latestReleasePoints.find(point => point.component === 'compiler') ?? null;
			const latestTokenizerPoint = latestReleasePoints.find(point => point.component === 'tokenizer') ?? null;
			const snapshotCount = new Set(coveragePoints.map(point => point.releaseKey)).size;
			const seriesLabel = mode === 'jitless' ? 'Deterministic (JIT off)' : 'Historical (JIT on)';

			lastUpdated.textContent = latestPoint
				? `${seriesLabel} · Latest compiler ${latestPoint.releaseTag} · ${shortCommit(latestPoint.commit)}`
				: `${seriesLabel} · No ${config.emptyLabel}`;
			coverageOverviewCaption.textContent = config.axisLabel;
			coverageBenchmarkCaption.textContent = `${config.axisLabel} by benchmark`;

			summaryGrid.innerHTML = [
				renderSummaryItem(
					config.pipelineSummaryLabel,
					latestPipelinePoint ? formatCount(latestPipelinePoint.value) : 'n/a',
					`${data.logs.length} benchmarks`
				),
				renderSummaryItem(
					config.compilerSummaryLabel,
					latestCompilerPoint ? formatCount(latestCompilerPoint.value) : 'n/a',
					`${data.logs.length} benchmarks`
				),
				renderSummaryItem(
					config.tokenizerSummaryLabel,
					latestTokenizerPoint ? formatCount(latestTokenizerPoint.value) : 'n/a',
					`${data.logs.length} benchmarks`
				),
				renderSummaryItem('Snapshots', String(snapshotCount), 'compiler releases'),
			].join('');

			renderCoverageOverview(overviewChart, summaryPoints, config);
			renderReportCards(grid, data.logs, {
				selectPoints: log => coveragePoints.filter(point => point.benchmark === log.benchmark),
				summary: points => {
					const latestPoints = getLatestReleasePoints(points);
					const latest =
						latestPoints.find(point => point.component === 'compilerPipeline') ??
						latestPoints.find(point => point.component === 'compiler') ??
						latestPoints.find(point => point.component === 'tokenizer');
					return {
						meta: latest ? formatReleaseMeta(latest) : '',
						value: latest ? formatCount(getCoverageMetricValue(latest, config.metric)) : 'n/a',
					};
				},
				renderTable: points => renderCoverageTable(points, config),
				chart: (container, points) => createCoverageBenchmarkChart(container, points, config),
			});
		},
	};
}

function toCoveragePoints(log: BenchmarkLog, entries: CompilerCoverageEntry[]) {
	return entries.flatMap(entry => {
		const version = entry.version ?? 'unknown';
		const releaseTag = `@8f4e/compiler@${version}`;

		return getSortedCoverageComponents(Object.keys(entry.coverage)).flatMap(component => {
			const bucket = entry.coverage[component];
			if (!bucket) {
				return [];
			}
			return {
				measurementMode: getCoverageMeasurementMode(entry),
				benchmark: log.benchmark,
				label: log.label,
				component,
				componentLabel: getCoverageComponentLabel(component),
				seriesLabel: `${log.label} ${getCoverageComponentLabel(component)}`,
				version,
				releaseTag,
				commit: entry.commit,
				releaseKey: entry.commit || version,
				releaseIndex: 0,
				releaseLabel: '',
				coveredFunctions: bucket.coveredFunctions,
				functionEntries: bucket.functionEntries,
				rangeExecutions: bucket.rangeExecutions,
			};
		});
	});
}

function renderCoverageOverview(
	overviewChart: HTMLElement,
	points: CoverageSummaryPoint[],
	config: CoverageMetricConfig
) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	replaceChart(
		overviewChart,
		Plot.plot({
			width: getChartWidth(overviewChart),
			height: 340,
			marginLeft: 72,
			marginRight: 24,
			marginTop: 18,
			marginBottom: 44,
			x: {
				label: null,
				grid: true,
				tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
			},
			y: {
				domain: getCountDomain(points.map(point => point.value)),
				label: config.axisLabel,
				grid: true,
				tickFormat: formatCompactCount,
			},
			color: { legend: true },
			marks: [
				...(hasTrend
					? [
							Plot.lineY(points, {
								x: 'releaseIndex',
								y: 'value',
								stroke: 'componentLabel',
								strokeWidth: 2.25,
								tip: true,
							}),
						]
					: []),
				Plot.dot(points, {
					x: 'releaseIndex',
					y: 'value',
					fill: 'componentLabel',
					r: 4,
					title: point =>
						`${point.componentLabel}\n${point.releaseTag}\n${point.releaseLabel}\n${formatCount(point.value)}`,
				}),
			],
		})
	);
}

function createCoverageBenchmarkChart(container: HTMLElement, points: CoveragePoint[], config: CoverageMetricConfig) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	return Plot.plot({
		width: getChartWidth(container),
		height: 170,
		marginLeft: 62,
		marginRight: 16,
		marginTop: 12,
		marginBottom: 36,
		x: {
			label: null,
			grid: true,
			tickFormat: index => releaseLabels.get(Number(index)) ?? String(index),
		},
		y: {
			domain: getCountDomain(points.map(point => getCoverageMetricValue(point, config.metric))),
			label: config.cardLabel,
			grid: true,
			tickFormat: formatCompactCount,
		},
		color: { legend: true },
		marks: [
			...(hasTrend
				? [
						Plot.lineY(points, {
							x: 'releaseIndex',
							y: point => getCoverageMetricValue(point, config.metric),
							stroke: 'componentLabel',
							strokeWidth: 2,
						}),
					]
				: []),
			Plot.dot(points, {
				x: 'releaseIndex',
				y: point => getCoverageMetricValue(point, config.metric),
				fill: 'componentLabel',
				r: 4,
				title: point =>
					`${point.componentLabel}\n${point.releaseTag}\n${point.releaseLabel}\n${formatCount(getCoverageMetricValue(point, config.metric))}`,
			}),
		],
	});
}

function renderCoverageTable(points: CoveragePoint[], config: CoverageMetricConfig) {
	if (points.length === 0) {
		return '<div class="empty-table">No snapshots</div>';
	}

	const releases = [...new Map(points.map(point => [point.releaseKey, point])).values()].slice(-8).reverse();
	const components = getSortedCoverageComponents([...new Set(points.map(point => point.component))]);

	return `
		<div class="file-table-wrap">
			<table class="file-table">
				<thead>
					<tr>
						<th>Release</th>
						${components.map(component => `<th>${escapeHtml(getCoverageComponentLabel(component))}</th>`).join('')}
					</tr>
				</thead>
				<tbody>
					${releases
						.map(release => {
							const releasePoints = points.filter(point => point.releaseKey === release.releaseKey);

							return `
								<tr>
									<td>${escapeHtml(release.releaseTag)}</td>
									${components
										.map(component => {
											const point = releasePoints.find(releasePoint => releasePoint.component === component);
											return `<td>${point ? formatCount(getCoverageMetricValue(point, config.metric)) : 'n/a'}</td>`;
										})
										.join('')}
								</tr>
							`;
						})
						.join('')}
				</tbody>
			</table>
		</div>
	`;
}

function toCoverageSummaryPoints(points: CoveragePoint[], metric: CoverageMetric) {
	const byReleaseAndComponent = new Map<string, CoverageSummaryPoint>();

	for (const point of points) {
		const key = `${point.releaseKey}:${point.component}`;
		const existingPoint = byReleaseAndComponent.get(key);
		const value = getCoverageMetricValue(point, metric);

		if (existingPoint) {
			existingPoint.value += value;
			continue;
		}

		byReleaseAndComponent.set(key, {
			component: point.component,
			componentLabel: point.componentLabel,
			version: point.version,
			releaseTag: point.releaseTag,
			commit: point.commit,
			releaseKey: point.releaseKey,
			releaseIndex: point.releaseIndex,
			releaseLabel: point.releaseLabel,
			value,
		});
	}

	return [...byReleaseAndComponent.values()];
}

function getCoverageMetricValue(point: CoveragePoint, metric: CoverageMetric) {
	return point[metric];
}

function getSortedCoverageComponents(components: readonly CoverageComponent[]) {
	return [...components].sort((left, right) => {
		const leftIndex = coverageComponentOrder.indexOf(left);
		const rightIndex = coverageComponentOrder.indexOf(right);

		if (leftIndex !== -1 || rightIndex !== -1) {
			return getCoverageComponentSortIndex(left) - getCoverageComponentSortIndex(right);
		}

		return left.localeCompare(right);
	});
}

function getCoverageComponentSortIndex(component: CoverageComponent) {
	const index = coverageComponentOrder.indexOf(component);
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getCoverageComponentLabel(component: CoverageComponent) {
	return coverageComponentLabels[component] ?? component;
}
