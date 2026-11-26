import * as Plot from '@observablehq/plot';
import {
	type CoverageMeasurementMode,
	getCoverageMeasurementMode,
	getPreferredCoverageMode,
	selectCoverageSeries,
} from './coverage-series';
import './styles.css';

type SizeMetric = 'raw' | 'gzip';

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

type TrackedLog = {
	packageName: string;
	label: string;
	path: string;
};

type BundleSizeManifest = {
	logs: TrackedLog[];
};

type BytecodeTrackedLog = {
	benchmark: string;
	label: string;
	path: string;
};

type BytecodeSizeManifest = {
	logs: BytecodeTrackedLog[];
};

type BytecodeSizeEntry = {
	commit: string;
	version: string | null;
	benchmark: string;
	emittedBytes: number;
};

type CoverageComponent = string;
type CoverageMetric = 'rangeExecutions' | 'functionEntries' | 'coveredFunctions';

type CoverageDashboardTab = 'ranges' | 'functionEntries' | 'coveredFunctions';

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

type TsdocCoverageManifest = {
	logs: TrackedLog[];
};

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

type TestCoverageManifest = {
	logs: TrackedLog[];
};

type TestCoverageMetric = 'statements' | 'branches' | 'functions' | 'lines';

type TestCoverageBucket = {
	covered: number;
	total: number;
	percentage: number;
};

type TestCoverageEntry = {
	commit: string;
	recordedAt: string;
	coverage: Record<TestCoverageMetric, TestCoverageBucket>;
};

type Point = {
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

type TestCoveragePoint = {
	packageName: string;
	label: string;
	recordedAt: Date;
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	coverage: Record<TestCoverageMetric, TestCoverageBucket>;
};

type TestCoverageSummaryPoint = {
	commit: string;
	releaseKey: string;
	releaseIndex: number;
	releaseLabel: string;
	covered: number;
	total: number;
	percentage: number;
};

type DashboardTab = 'bundles' | 'bytecode' | 'tsdoc' | 'tests' | CoverageDashboardTab;

const app = requireElement<HTMLDivElement>('#app');

app.innerHTML = `
	<header class="app-header">
		<div>
			<h1>Metrics Dashboard</h1>
			<p id="last-updated"></p>
		</div>
		<div class="controls" aria-label="Dashboard controls">
			<div class="segmented" role="tablist" aria-label="Metric view">
				<button type="button" class="segment is-active" data-tab="bundles">Bundles</button>
				<button type="button" class="segment" data-tab="bytecode">Bytecode</button>
				<button type="button" class="segment" data-tab="tsdoc">TSDoc</button>
				<button type="button" class="segment" data-tab="tests">Tests</button>
				<button type="button" class="segment" data-tab="ranges">Ranges</button>
				<button type="button" class="segment" data-tab="functionEntries">Function Entries</button>
				<button type="button" class="segment" data-tab="coveredFunctions">Covered Functions</button>
			</div>
			<div class="segmented" id="metric-control" role="group" aria-label="Size metric">
				<button type="button" class="segment is-active" data-metric="gzip">Gzip</button>
				<button type="button" class="segment" data-metric="raw">Raw</button>
			</div>
			<div class="segmented" id="coverage-mode-control" role="group" aria-label="Compiler measurement series" hidden>
				<button type="button" class="segment" data-coverage-mode="jitless">Deterministic (JIT off)</button>
				<button type="button" class="segment" data-coverage-mode="legacy">Historical (JIT on)</button>
			</div>
		</div>
	</header>
	<main>
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
		<div id="tests-view" hidden>
			<section class="summary-grid" id="tests-summary-grid" aria-label="Latest test coverage summary"></section>
			<section class="chart-section">
				<div class="section-heading">
					<h2>Coverage</h2>
					<span>Line coverage percentage</span>
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
	</main>
`;

const state = {
	tab: 'bundles' as DashboardTab,
	metric: 'gzip' as SizeMetric,
	coverageMode: 'legacy' as CoverageMeasurementMode,
	trackedLogs: [] as TrackedLog[],
	points: [] as Point[],
	bytecodeLogs: [] as BytecodeTrackedLog[],
	bytecodePoints: [] as BytecodePoint[],
	coverageLogs: [] as BytecodeTrackedLog[],
	coveragePoints: [] as CoveragePoint[],
	tsdocLogs: [] as TrackedLog[],
	tsdocPoints: [] as TsdocCoveragePoint[],
	testLogs: [] as TrackedLog[],
	testPoints: [] as TestCoveragePoint[],
};

const bundlesView = requireElement<HTMLDivElement>('#bundles-view');
const bytecodeView = requireElement<HTMLDivElement>('#bytecode-view');
const tsdocView = requireElement<HTMLDivElement>('#tsdoc-view');
const testsView = requireElement<HTMLDivElement>('#tests-view');
const rangesView = requireElement<HTMLDivElement>('#ranges-view');
const summaryGrid = requireElement<HTMLDivElement>('#summary-grid');
const overviewChart = requireElement<HTMLDivElement>('#overview-chart');
const bytecodeSummaryGrid = requireElement<HTMLDivElement>('#bytecode-summary-grid');
const bytecodeOverviewChart = requireElement<HTMLDivElement>('#bytecode-overview-chart');
const bytecodeGrid = requireElement<HTMLDivElement>('#bytecode-grid');
const tsdocSummaryGrid = requireElement<HTMLDivElement>('#tsdoc-summary-grid');
const tsdocOverviewChart = requireElement<HTMLDivElement>('#tsdoc-overview-chart');
const tsdocGrid = requireElement<HTMLDivElement>('#tsdoc-grid');
const testsSummaryGrid = requireElement<HTMLDivElement>('#tests-summary-grid');
const testsOverviewChart = requireElement<HTMLDivElement>('#tests-overview-chart');
const testsGrid = requireElement<HTMLDivElement>('#tests-grid');
const rangesSummaryGrid = requireElement<HTMLDivElement>('#ranges-summary-grid');
const rangesOverviewChart = requireElement<HTMLDivElement>('#ranges-overview-chart');
const rangesGrid = requireElement<HTMLDivElement>('#ranges-grid');
const coverageOverviewCaption = requireElement<HTMLSpanElement>('#coverage-overview-caption');
const coverageBenchmarkCaption = requireElement<HTMLSpanElement>('#coverage-benchmark-caption');
const lastUpdated = requireElement<HTMLParagraphElement>('#last-updated');
const growthCaption = requireElement<HTMLSpanElement>('#growth-caption');
const packageCaption = requireElement<HTMLSpanElement>('#package-caption');
const packageGrid = requireElement<HTMLDivElement>('#package-grid');
const metricControl = requireElement<HTMLDivElement>('#metric-control');
const coverageModeControl = requireElement<HTMLDivElement>('#coverage-mode-control');
const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
const metricButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-metric]')];
const coverageModeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-coverage-mode]')];

init().catch((error: unknown) => {
	app.innerHTML = `<div class="error-state"><h1>Metrics Dashboard</h1><p>${escapeHtml(getErrorMessage(error))}</p></div>`;
});

async function init() {
	for (const button of tabButtons) {
		button.addEventListener('click', () => {
			state.tab = button.dataset.tab as DashboardTab;
			render();
		});
	}

	for (const button of metricButtons) {
		button.addEventListener('click', () => {
			state.metric = button.dataset.metric as SizeMetric;
			render();
		});
	}

	for (const button of coverageModeButtons) {
		button.addEventListener('click', () => {
			state.coverageMode = button.dataset.coverageMode as CoverageMeasurementMode;
			render();
		});
	}

	window.addEventListener('resize', debounce(render, 100));

	const [trackedLogs, bytecodeLogs, coverageLogs, tsdocLogs, testLogs] = await Promise.all([
		loadTrackedLogs(),
		loadBytecodeTrackedLogs(),
		loadCoverageTrackedLogs(),
		loadTsdocTrackedLogs(),
		loadTestTrackedLogs(),
	]);
	state.trackedLogs = trackedLogs;
	state.bytecodeLogs = bytecodeLogs;
	state.coverageLogs = coverageLogs;
	state.tsdocLogs = tsdocLogs;
	state.testLogs = testLogs;
	const [points, bytecodePoints, coveragePoints, tsdocPoints, testPoints] = await Promise.all([
		loadPoints(state.trackedLogs),
		loadBytecodePoints(state.bytecodeLogs),
		loadCoveragePoints(state.coverageLogs),
		loadTsdocPoints(state.tsdocLogs),
		loadTestPoints(state.testLogs),
	]);
	state.points = points;
	state.bytecodePoints = bytecodePoints;
	state.coveragePoints = coveragePoints;
	state.coverageMode = getPreferredCoverageMode(coveragePoints);
	state.tsdocPoints = tsdocPoints;
	state.testPoints = testPoints;
	render();
}

async function loadTrackedLogs() {
	const response = await fetch('bundle-sizes/manifest.json', {
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`Failed to load bundle size manifest: ${response.status}`);
	}

	const manifest = (await response.json()) as BundleSizeManifest;
	return manifest.logs;
}

async function loadBytecodeTrackedLogs() {
	const response = await fetch('bytecode-size/manifest.json', {
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`Failed to load bytecode size manifest: ${response.status}`);
	}

	const manifest = (await response.json()) as BytecodeSizeManifest;
	return manifest.logs;
}

async function loadCoverageTrackedLogs() {
	const response = await fetch('compiler-coverage-counts/manifest.json', {
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`Failed to load compiler coverage count manifest: ${response.status}`);
	}

	const manifest = (await response.json()) as BytecodeSizeManifest;
	return manifest.logs;
}

async function loadTsdocTrackedLogs() {
	const response = await fetch('tsdoc-coverage/manifest.json', {
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`Failed to load TSDoc coverage manifest: ${response.status}`);
	}

	const manifest = (await response.json()) as TsdocCoverageManifest;
	return manifest.logs;
}

async function loadTestTrackedLogs() {
	const response = await fetch('test-coverage/manifest.json', {
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`Failed to load test coverage manifest: ${response.status}`);
	}

	const manifest = (await response.json()) as TestCoverageManifest;
	return manifest.logs;
}

async function loadPoints(trackedLogs: TrackedLog[]) {
	const pointGroups = await Promise.all(
		trackedLogs.map(async log => {
			const response = await fetch(`bundle-sizes/${log.path}`, {
				cache: 'no-store',
			});

			if (!response.ok) {
				throw new Error(`Failed to load ${log.path}: ${response.status}`);
			}

			const entries = (await response.json()) as BundleSizeEntry[];
			return toPoints(log, entries);
		})
	);

	return withReleaseIndexes(pointGroups.flat());
}

async function loadBytecodePoints(trackedLogs: BytecodeTrackedLog[]) {
	const pointGroups = await Promise.all(
		trackedLogs.map(async log => {
			const response = await fetch(`bytecode-size/${log.path}`, {
				cache: 'no-store',
			});

			if (!response.ok) {
				throw new Error(`Failed to load ${log.path}: ${response.status}`);
			}

			const entries = (await response.json()) as BytecodeSizeEntry[];
			return toBytecodePoints(log, entries);
		})
	);

	return withSequentialReleaseIndexes(pointGroups.flat());
}

async function loadCoveragePoints(trackedLogs: BytecodeTrackedLog[]) {
	const pointGroups = await Promise.all(
		trackedLogs.map(async log => {
			const response = await fetch(`compiler-coverage-counts/${log.path}`, {
				cache: 'no-store',
			});

			if (!response.ok) {
				throw new Error(`Failed to load ${log.path}: ${response.status}`);
			}

			const entries = (await response.json()) as CompilerCoverageEntry[];
			return toCoveragePoints(log, entries);
		})
	);

	return pointGroups.flat();
}

async function loadTsdocPoints(trackedLogs: TrackedLog[]) {
	const pointGroups = await Promise.all(
		trackedLogs.map(async log => {
			const response = await fetch(`tsdoc-coverage/${log.path}`, {
				cache: 'no-store',
			});

			if (!response.ok) {
				throw new Error(`Failed to load ${log.path}: ${response.status}`);
			}

			const entries = (await response.json()) as TsdocCoverageEntry[];
			return toTsdocPoints(log, entries);
		})
	);

	return withTsdocReleaseIndexes(pointGroups.flat());
}

async function loadTestPoints(trackedLogs: TrackedLog[]) {
	const pointGroups = await Promise.all(
		trackedLogs.map(async log => {
			const response = await fetch(`test-coverage/${log.path}`, {
				cache: 'no-store',
			});

			if (!response.ok) {
				throw new Error(`Failed to load ${log.path}: ${response.status}`);
			}

			const entries = (await response.json()) as TestCoverageEntry[];
			return toTestPoints(log, entries);
		})
	);

	return withTestReleaseIndexes(pointGroups.flat());
}

function toPoints(log: TrackedLog, entries: BundleSizeEntry[]) {
	const sortedEntries = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
	const points: Point[] = [];

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

function toBytecodePoints(log: BytecodeTrackedLog, entries: BytecodeSizeEntry[]) {
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

function toCoveragePoints(log: BytecodeTrackedLog, entries: CompilerCoverageEntry[]) {
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

function toTsdocPoints(log: TrackedLog, entries: TsdocCoverageEntry[]) {
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

function toTestPoints(log: TrackedLog, entries: TestCoverageEntry[]) {
	return entries.map(entry => ({
		packageName: log.packageName,
		label: log.label,
		recordedAt: new Date(entry.recordedAt),
		commit: entry.commit,
		releaseKey: entry.commit || entry.recordedAt,
		releaseIndex: 0,
		releaseLabel: '',
		coverage: entry.coverage,
	}));
}

function withReleaseIndexes(points: Point[]) {
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

function withSequentialReleaseIndexes<TPoint extends { releaseKey: string; commit: string; version: string }>(
	points: TPoint[]
) {
	const releases = [...new Map(points.map(point => [point.releaseKey, point])).values()].map((point, index) => ({
		key: point.releaseKey,
		index,
		label: `${index + 1} · ${point.version}`,
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

function withTsdocReleaseIndexes(points: TsdocCoveragePoint[]) {
	const releases = [...new Map(points.map(point => [point.releaseKey, point])).values()]
		.sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
		.map((point, index) => ({
			key: point.releaseKey,
			index,
			label: `${index + 1} · ${shortCommit(point.commit)}`,
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

function withTestReleaseIndexes(points: TestCoveragePoint[]) {
	const releases = [...new Map(points.map(point => [point.releaseKey, point])).values()]
		.sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
		.map((point, index) => ({
			key: point.releaseKey,
			index,
			label: `${index + 1} · ${shortCommit(point.commit)}`,
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

function isCoverageDashboardTab(tab: DashboardTab): tab is CoverageDashboardTab {
	return tab in coverageMetricConfigs;
}

function render() {
	bundlesView.hidden = state.tab !== 'bundles';
	bytecodeView.hidden = state.tab !== 'bytecode';
	tsdocView.hidden = state.tab !== 'tsdoc';
	testsView.hidden = state.tab !== 'tests';
	rangesView.hidden = !isCoverageDashboardTab(state.tab);
	metricControl.hidden = state.tab !== 'bundles';
	coverageModeControl.hidden = !isCoverageDashboardTab(state.tab);

	for (const button of tabButtons) {
		button.classList.toggle('is-active', button.dataset.tab === state.tab);
	}

	for (const button of metricButtons) {
		button.classList.toggle('is-active', button.dataset.metric === state.metric);
	}
	for (const button of coverageModeButtons) {
		const active = button.dataset.coverageMode === state.coverageMode;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-pressed', String(active));
	}

	if (state.tab === 'bytecode') {
		renderBytecode();
		return;
	}

	if (state.tab === 'tsdoc') {
		renderTsdoc();
		return;
	}

	if (state.tab === 'tests') {
		renderTests();
		return;
	}

	if (isCoverageDashboardTab(state.tab)) {
		renderCoverage(coverageMetricConfigs[state.tab]);
		return;
	}

	const metricPoints = state.points.filter(point => point.metric === state.metric);
	const latestPoints = getLatestPoints(metricPoints);
	const latestDate = getLatestDate(latestPoints);

	lastUpdated.textContent = latestDate ? `Last recorded ${formatDateTime(latestDate)}` : 'No recorded data';
	growthCaption.textContent = metricLabel(state.metric);
	packageCaption.textContent = metricLabel(state.metric);

	renderSummary(latestPoints);
	renderOverview(metricPoints);
	renderPackageGrid(metricPoints);
}

function renderSummary(latestPoints: Point[]) {
	const websitePoint = latestPoints.find(point => point.packageName === '@8f4e/editor-webapp') ?? null;
	const totalTrackedBytes = latestPoints.reduce((sum, point) => sum + point.bytes, 0);
	const snapshotCount = new Set(state.points.map(point => point.releaseKey)).size;

	summaryGrid.innerHTML = [
		renderSummaryItem(
			'Website',
			websitePoint ? formatBytes(websitePoint.bytes) : 'n/a',
			websitePoint ? formatPointMeta(websitePoint) : ''
		),
		renderSummaryItem('Tracked Total', formatBytes(totalTrackedBytes), `${latestPoints.length} packages`),
		renderSummaryItem('Snapshots', String(snapshotCount), 'release commits'),
	].join('');
}

function renderBytecode() {
	const latestReleasePoints = getLatestBytecodeReleasePoints(state.bytecodePoints);
	const latestPoint = latestReleasePoints[0] ?? null;
	const latestReleaseBytes = latestReleasePoints.reduce((sum, point) => sum + point.bytes, 0);
	const snapshotCount = new Set(state.bytecodePoints.map(point => point.releaseKey)).size;

	lastUpdated.textContent = latestPoint
		? `Latest compiler ${latestPoint.releaseTag} · ${shortCommit(latestPoint.commit)}`
		: 'No bytecode data';

	bytecodeSummaryGrid.innerHTML = [
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

	renderBytecodeOverview(state.bytecodePoints);
	renderBytecodeGrid(state.bytecodePoints);
}

function renderTsdoc() {
	const latestReleasePoints = getLatestTsdocReleasePoints(state.tsdocPoints);
	const latestPoint = latestReleasePoints[0] ?? null;
	const latestCoverage = summarizeTsdocCoverage(latestReleasePoints);
	const snapshotCount = new Set(state.tsdocPoints.map(point => point.releaseKey)).size;

	lastUpdated.textContent = latestPoint
		? `Latest TSDoc coverage ${latestPoint.releaseLabel} · ${formatDateTime(latestPoint.recordedAt)}`
		: 'No TSDoc coverage data';

	tsdocSummaryGrid.innerHTML = [
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

	renderTsdocOverview(state.tsdocPoints);
	renderTsdocGrid(state.tsdocPoints);
}

function renderTests() {
	const latestReleasePoints = getLatestTestReleasePoints(state.testPoints);
	const latestPoint = latestReleasePoints[0] ?? null;
	const latestCoverage = summarizeTestCoverage(latestReleasePoints, 'lines');
	const snapshotCount = new Set(state.testPoints.map(point => point.releaseKey)).size;

	lastUpdated.textContent = latestPoint
		? `Latest test coverage ${latestPoint.releaseLabel} · ${formatDateTime(latestPoint.recordedAt)}`
		: 'No test coverage data';

	testsSummaryGrid.innerHTML = [
		renderSummaryItem(
			'Line Coverage',
			latestCoverage ? formatPercent(latestCoverage.percentage) : 'n/a',
			latestCoverage ? `${formatCount(latestCoverage.covered)} / ${formatCount(latestCoverage.total)} covered` : ''
		),
		renderSummaryItem('Packages', String(latestReleasePoints.length), 'tracked packages'),
		renderSummaryItem('Snapshots', String(snapshotCount), 'recorded commits'),
	].join('');

	renderTestOverview(state.testPoints);
	renderTestGrid(state.testPoints);
}

function renderCoverage(config: CoverageMetricConfig) {
	const coveragePoints = withSequentialReleaseIndexes(selectCoverageSeries(state.coveragePoints, state.coverageMode));
	const summaryPoints = toCoverageSummaryPoints(coveragePoints, config.metric);
	const latestReleasePoints = getLatestCoverageReleasePoints(summaryPoints);
	const latestPoint = latestReleasePoints[0] ?? null;
	const latestPipelinePoint = latestReleasePoints.find(point => point.component === 'compilerPipeline') ?? null;
	const latestCompilerPoint = latestReleasePoints.find(point => point.component === 'compiler') ?? null;
	const latestTokenizerPoint = latestReleasePoints.find(point => point.component === 'tokenizer') ?? null;
	const snapshotCount = new Set(coveragePoints.map(point => point.releaseKey)).size;
	const seriesLabel = state.coverageMode === 'jitless' ? 'Deterministic (JIT off)' : 'Historical (JIT on)';

	lastUpdated.textContent = latestPoint
		? `${seriesLabel} · Latest compiler ${latestPoint.releaseTag} · ${shortCommit(latestPoint.commit)}`
		: `${seriesLabel} · No ${config.emptyLabel}`;
	coverageOverviewCaption.textContent = config.axisLabel;
	coverageBenchmarkCaption.textContent = `${config.axisLabel} by benchmark`;

	rangesSummaryGrid.innerHTML = [
		renderSummaryItem(
			config.pipelineSummaryLabel,
			latestPipelinePoint ? formatCount(latestPipelinePoint.value) : 'n/a',
			`${state.coverageLogs.length} benchmarks`
		),
		renderSummaryItem(
			config.compilerSummaryLabel,
			latestCompilerPoint ? formatCount(latestCompilerPoint.value) : 'n/a',
			`${state.coverageLogs.length} benchmarks`
		),
		renderSummaryItem(
			config.tokenizerSummaryLabel,
			latestTokenizerPoint ? formatCount(latestTokenizerPoint.value) : 'n/a',
			`${state.coverageLogs.length} benchmarks`
		),
		renderSummaryItem('Snapshots', String(snapshotCount), 'compiler releases'),
	].join('');

	renderCoverageOverview(summaryPoints, config);
	renderCoverageGrid(coveragePoints, config);
}

function renderSummaryItem(label: string, value: string, meta: string) {
	return `
		<article class="summary-item">
			<span>${escapeHtml(label)}</span>
			<strong>${escapeHtml(value)}</strong>
			<small>${escapeHtml(meta)}</small>
		</article>
	`;
}

function renderCoverageOverview(points: CoverageSummaryPoint[], config: CoverageMetricConfig) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	replaceChart(
		rangesOverviewChart,
		Plot.plot({
			width: getChartWidth(rangesOverviewChart),
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

function renderTsdocOverview(points: TsdocCoveragePoint[]) {
	const summaryPoints = toTsdocSummaryPoints(points);
	const releaseLabels = getReleaseLabels(summaryPoints);
	const hasTrend = hasMultipleSnapshots(summaryPoints);

	replaceChart(
		tsdocOverviewChart,
		Plot.plot({
			width: getChartWidth(tsdocOverviewChart),
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

function renderTestOverview(points: TestCoveragePoint[]) {
	const summaryPoints = toTestSummaryPoints(points, 'lines');
	const releaseLabels = getReleaseLabels(summaryPoints);
	const hasTrend = hasMultipleSnapshots(summaryPoints);

	replaceChart(
		testsOverviewChart,
		Plot.plot({
			width: getChartWidth(testsOverviewChart),
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
						`${point.releaseLabel}\n${formatPercent(point.percentage)}\n${formatCount(point.covered)} / ${formatCount(point.total)} lines covered`,
				}),
			],
		})
	);
}

function renderBytecodeOverview(points: BytecodePoint[]) {
	const releaseLabels = getReleaseLabels(points);
	const hasTrend = hasMultipleSnapshots(points);

	replaceChart(
		bytecodeOverviewChart,
		Plot.plot({
			width: getChartWidth(bytecodeOverviewChart),
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

function renderOverview(points: Point[]) {
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
				label: `${metricLabel(state.metric)} bytes`,
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

function renderBytecodeGrid(points: BytecodePoint[]) {
	bytecodeGrid.replaceChildren();

	for (const log of state.bytecodeLogs) {
		const benchmarkPoints = points.filter(point => point.benchmark === log.benchmark);
		const latestPoint = benchmarkPoints[benchmarkPoints.length - 1] ?? null;
		const card = document.createElement('article');
		card.className = 'package-card';
		card.innerHTML = `
			<div class="package-card-header">
				<div>
					<h3>${escapeHtml(log.label)}</h3>
					<p>${latestPoint ? escapeHtml(formatBytecodePointMeta(latestPoint)) : ''}</p>
				</div>
				<strong>${latestPoint ? escapeHtml(formatBytes(latestPoint.bytes)) : 'n/a'}</strong>
			</div>
			<div class="package-card-chart"></div>
			${renderBytecodeTable(benchmarkPoints)}
		`;

		bytecodeGrid.append(card);
		const chartContainer = card.querySelector<HTMLElement>('.package-card-chart');

		if (chartContainer) {
			replaceChart(chartContainer, createBytecodeBenchmarkChart(chartContainer, benchmarkPoints));
		}
	}
}

function renderCoverageGrid(points: CoveragePoint[], config: CoverageMetricConfig) {
	rangesGrid.replaceChildren();

	for (const log of state.coverageLogs) {
		const benchmarkPoints = points.filter(point => point.benchmark === log.benchmark);
		const latestPoints = getLatestCoverageReleasePoints(benchmarkPoints);
		const latestPipelinePoint = latestPoints.find(point => point.component === 'compilerPipeline') ?? null;
		const latestCompilerPoint = latestPoints.find(point => point.component === 'compiler') ?? null;
		const latestTokenizerPoint = latestPoints.find(point => point.component === 'tokenizer') ?? null;
		const latestPoint = latestPipelinePoint ?? latestCompilerPoint ?? latestTokenizerPoint;
		const card = document.createElement('article');
		card.className = 'package-card';
		card.innerHTML = `
			<div class="package-card-header">
				<div>
					<h3>${escapeHtml(log.label)}</h3>
					<p>${latestPoint ? escapeHtml(formatCoveragePointMeta(latestPoint)) : ''}</p>
				</div>
				<strong>${latestPoint ? escapeHtml(formatCount(getCoverageMetricValue(latestPoint, config.metric))) : 'n/a'}</strong>
			</div>
			<div class="package-card-chart"></div>
			${renderCoverageTable(benchmarkPoints, config)}
		`;

		rangesGrid.append(card);
		const chartContainer = card.querySelector<HTMLElement>('.package-card-chart');

		if (chartContainer) {
			replaceChart(chartContainer, createCoverageBenchmarkChart(chartContainer, benchmarkPoints, config));
		}
	}
}

function renderTsdocGrid(points: TsdocCoveragePoint[]) {
	tsdocGrid.replaceChildren();

	for (const log of state.tsdocLogs) {
		const packagePoints = points.filter(point => point.packageName === log.packageName);
		const latestPoint = packagePoints[packagePoints.length - 1] ?? null;
		const card = document.createElement('article');
		card.className = 'package-card';
		card.innerHTML = `
			<div class="package-card-header">
				<div>
					<h3>${escapeHtml(log.label)}</h3>
					<p>${latestPoint ? escapeHtml(formatTsdocPointMeta(latestPoint)) : ''}</p>
				</div>
				<strong>${latestPoint ? escapeHtml(formatPercent(latestPoint.percentage)) : 'n/a'}</strong>
			</div>
			<div class="package-card-chart"></div>
			${renderTsdocTable(packagePoints)}
		`;

		tsdocGrid.append(card);
		const chartContainer = card.querySelector<HTMLElement>('.package-card-chart');

		if (chartContainer) {
			replaceChart(chartContainer, createTsdocPackageChart(chartContainer, packagePoints));
		}
	}
}

function renderTestGrid(points: TestCoveragePoint[]) {
	testsGrid.replaceChildren();

	for (const log of state.testLogs) {
		const packagePoints = points.filter(point => point.packageName === log.packageName);
		const latestPoint = packagePoints[packagePoints.length - 1] ?? null;
		const card = document.createElement('article');
		card.className = 'package-card';
		card.innerHTML = `
			<div class="package-card-header">
				<div>
					<h3>${escapeHtml(log.label)}</h3>
					<p>${latestPoint ? escapeHtml(formatTestPointMeta(latestPoint)) : ''}</p>
				</div>
				<strong>${latestPoint ? escapeHtml(formatPercent(latestPoint.coverage.lines.percentage)) : 'n/a'}</strong>
			</div>
			<div class="package-card-chart"></div>
			${renderTestTable(packagePoints)}
		`;

		testsGrid.append(card);
		const chartContainer = card.querySelector<HTMLElement>('.package-card-chart');

		if (chartContainer) {
			replaceChart(chartContainer, createTestPackageChart(chartContainer, packagePoints));
		}
	}
}

function renderPackageGrid(points: Point[]) {
	packageGrid.replaceChildren();

	for (const log of state.trackedLogs) {
		const packagePoints = points.filter(point => point.packageName === log.packageName);
		const latestPoint = packagePoints[packagePoints.length - 1] ?? null;
		const card = document.createElement('article');
		card.className = 'package-card';
		card.innerHTML = `
			<div class="package-card-header">
				<div>
					<h3>${escapeHtml(log.label)}</h3>
					<p>${latestPoint ? escapeHtml(formatPointMeta(latestPoint)) : ''}</p>
				</div>
				<strong>${latestPoint ? escapeHtml(formatBytes(latestPoint.bytes)) : 'n/a'}</strong>
			</div>
			<div class="package-card-chart"></div>
		`;

		packageGrid.append(card);
		const chartContainer = card.querySelector<HTMLElement>('.package-card-chart');

		if (chartContainer) {
			replaceChart(chartContainer, createPackageChart(chartContainer, packagePoints));
		}
	}
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
							stroke: '#1d4ed8',
							strokeWidth: 2,
						}),
					]
				: []),
			Plot.dot(points, {
				x: 'releaseIndex',
				y: point => point.coverage.lines.percentage,
				fill: '#1d4ed8',
				r: 4,
				title: point =>
					`${point.releaseLabel}\n${formatPercent(point.coverage.lines.percentage)}\n${formatCount(point.coverage.lines.covered)} / ${formatCount(point.coverage.lines.total)} lines covered`,
			}),
		],
	});
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

function createPackageChart(container: HTMLElement, points: Point[]) {
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
			label: `${metricLabel(state.metric)} bytes`,
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

function replaceChart(container: HTMLElement, chart: SVGSVGElement | HTMLElement) {
	container.replaceChildren(chart);
}

function getLatestPoints(points: Point[]) {
	return state.trackedLogs
		.map(log => points.filter(point => point.packageName === log.packageName).at(-1))
		.filter((point): point is Point => Boolean(point));
}

function getLatestBytecodeReleasePoints(points: BytecodePoint[]) {
	const latestReleaseIndex = Math.max(-1, ...points.map(point => point.releaseIndex));

	return points.filter(point => point.releaseIndex === latestReleaseIndex);
}

function getLatestCoverageReleasePoints<TPoint extends { releaseIndex: number }>(points: TPoint[]) {
	const latestReleaseIndex = Math.max(-1, ...points.map(point => point.releaseIndex));

	return points.filter(point => point.releaseIndex === latestReleaseIndex);
}

function getLatestTsdocReleasePoints(points: TsdocCoveragePoint[]) {
	const latestReleaseIndex = Math.max(-1, ...points.map(point => point.releaseIndex));

	return points.filter(point => point.releaseIndex === latestReleaseIndex);
}

function getLatestTestReleasePoints(points: TestCoveragePoint[]) {
	const latestReleaseIndex = Math.max(-1, ...points.map(point => point.releaseIndex));

	return points.filter(point => point.releaseIndex === latestReleaseIndex);
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

function toTestSummaryPoints(points: TestCoveragePoint[], metric: TestCoverageMetric): TestCoverageSummaryPoint[] {
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

function getCoveragePercentage(covered: number, total: number) {
	if (total === 0) {
		return 100;
	}

	return Number(((covered / total) * 100).toFixed(1));
}

function getLatestDate(points: Point[]) {
	return points.map(point => point.recordedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
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

function getChartWidth(container: HTMLElement) {
	return Math.max(280, Math.floor(container.getBoundingClientRect().width));
}

function getReleaseLabels(points: Array<{ releaseIndex: number; releaseLabel: string }>) {
	return new Map(points.map(point => [point.releaseIndex, point.releaseLabel]));
}

function hasMultipleSnapshots(points: Array<{ releaseIndex: number }>) {
	return new Set(points.map(point => point.releaseIndex)).size > 1;
}

function getByteDomain(points: Array<{ bytes: number }>): [number, number] | undefined {
	const values = points.map(point => point.bytes).filter(Number.isFinite);

	if (values.length === 0) {
		return;
	}

	const min = Math.min(...values);
	const max = Math.max(...values);
	const spread = max - min;
	const padding = Math.max(spread * 0.12, max * 0.01, 1);

	return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
}

function getCountDomain(values: number[]): [number, number] | undefined {
	const finiteValues = values.filter(Number.isFinite);

	if (finiteValues.length === 0) {
		return;
	}

	const min = Math.min(...finiteValues);
	const max = Math.max(...finiteValues);
	const spread = max - min;
	const padding = Math.max(spread * 0.12, max * 0.01, 1);

	return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
}

function formatBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatCompactBytes(bytes: number) {
	if (Math.abs(bytes) < 1024) {
		return `${bytes} B`;
	}

	return `${Math.round(bytes / 1024)} KiB`;
}

function formatCount(value: number) {
	return new Intl.NumberFormat(undefined).format(value);
}

function formatCompactCount(value: number) {
	return new Intl.NumberFormat(undefined, {
		notation: 'compact',
		maximumFractionDigits: 1,
	}).format(value);
}

function formatPointMeta(point: Point) {
	return `${point.releaseTag} · ${shortCommit(point.commit)}`;
}

function formatBytecodePointMeta(point: BytecodePoint) {
	return `${point.releaseTag} · ${shortCommit(point.commit)}`;
}

function formatCoveragePointMeta(point: CoveragePoint | CoverageSummaryPoint) {
	return `${point.releaseTag} · ${shortCommit(point.commit)}`;
}

function formatTsdocPointMeta(point: TsdocCoveragePoint) {
	return `${point.releaseLabel} · ${formatCount(point.documented)} / ${formatCount(point.total)} documented`;
}

function formatTestPointMeta(point: TestCoveragePoint) {
	return `${point.releaseLabel} · ${formatCount(point.coverage.lines.covered)} / ${formatCount(point.coverage.lines.total)} lines`;
}

function metricLabel(metric: SizeMetric) {
	return metric === 'raw' ? 'Raw' : 'Gzip';
}

function formatPercent(value: number) {
	return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function shortCommit(commit: string) {
	return commit.slice(0, 8);
}

function formatDateTime(date: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

function debounce(callback: () => void, waitMs: number) {
	let timeout: number | undefined;

	return () => {
		window.clearTimeout(timeout);
		timeout = window.setTimeout(callback, waitMs);
	};
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function requireElement<TElement extends Element>(selector: string) {
	const element = document.querySelector<TElement>(selector);

	if (!element) {
		throw new Error(`Missing element: ${selector}`);
	}

	return element;
}
