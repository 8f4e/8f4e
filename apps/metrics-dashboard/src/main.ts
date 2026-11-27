import { bundlesMarkup, createBundleReport, type SizeMetric } from './reports/bundles';
import { bytecodeMarkup, createBytecodeReport } from './reports/bytecode';
import {
	type CoverageDashboardTab,
	coverageMarkup,
	createCoverageReport,
	isCoverageDashboardTab,
} from './reports/compiler-coverage';
import type { CoverageMeasurementMode } from './reports/coverage-series';
import { createTsdocReport, tsdocMarkup } from './reports/tsdoc';
import { debounce, escapeHtml, getErrorMessage, requireElement } from './shared/dom';
import './styles.css';

type DashboardTab = 'bundles' | 'bytecode' | 'tsdoc' | CoverageDashboardTab;

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
			<select class="runtime-select" id="coverage-runtime-control" aria-label="Deterministic runtime version" hidden></select>
		</div>
	</header>
	<main>
		${bundlesMarkup}
		${bytecodeMarkup}
		${tsdocMarkup}
		${coverageMarkup}
	</main>
`;

const lastUpdated = requireElement<HTMLParagraphElement>('#last-updated');
const bundles = createBundleReport(lastUpdated);
const bytecode = createBytecodeReport(lastUpdated);
const tsdoc = createTsdocReport(lastUpdated);
const coverage = createCoverageReport(lastUpdated);

const state = {
	tab: 'bundles' as DashboardTab,
	metric: 'gzip' as SizeMetric,
	coverageMode: 'legacy' as CoverageMeasurementMode,
	coverageRuntime: undefined as string | undefined,
};

const metricControl = requireElement<HTMLDivElement>('#metric-control');
const coverageModeControl = requireElement<HTMLDivElement>('#coverage-mode-control');
const coverageRuntimeControl = requireElement<HTMLSelectElement>('#coverage-runtime-control');
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
	coverageRuntimeControl.addEventListener('change', () => {
		state.coverageRuntime = coverageRuntimeControl.value;
		render();
	});

	window.addEventListener('resize', debounce(render, 100));

	await Promise.all([bundles.load(), bytecode.load(), tsdoc.load(), coverage.load()]);
	state.coverageMode = coverage.preferredMode();
	const runtimes = coverage.runtimeOptions();
	coverageRuntimeControl.replaceChildren(...runtimes.map(runtime => new Option(runtime.label, runtime.key)));
	state.coverageRuntime = runtimes[0]?.key;
	render();
}

function render() {
	bundles.view.hidden = state.tab !== 'bundles';
	bytecode.view.hidden = state.tab !== 'bytecode';
	tsdoc.view.hidden = state.tab !== 'tsdoc';
	coverage.view.hidden = !isCoverageDashboardTab(state.tab);
	metricControl.hidden = state.tab !== 'bundles';
	coverageModeControl.hidden = !isCoverageDashboardTab(state.tab);
	coverageRuntimeControl.hidden =
		!isCoverageDashboardTab(state.tab) || state.coverageMode !== 'jitless' || coverageRuntimeControl.options.length < 2;

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
		bytecode.render();
	} else if (state.tab === 'tsdoc') {
		tsdoc.render();
	} else if (isCoverageDashboardTab(state.tab)) {
		coverage.render(state.tab, state.coverageMode, state.coverageRuntime);
	} else {
		bundles.render(state.metric);
	}
}
