export function replaceChart(container: HTMLElement, chart: SVGSVGElement | HTMLElement) {
	container.replaceChildren(chart);
}

export function getChartWidth(container: HTMLElement) {
	return Math.max(280, Math.floor(container.getBoundingClientRect().width));
}

export function getReleaseLabels(points: Array<{ releaseIndex: number; releaseLabel: string }>) {
	return new Map(points.map(point => [point.releaseIndex, point.releaseLabel]));
}

export function hasMultipleSnapshots(points: Array<{ releaseIndex: number }>) {
	return new Set(points.map(point => point.releaseIndex)).size > 1;
}

export function getCountDomain(values: number[]): [number, number] | undefined {
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

export function getByteDomain(points: Array<{ bytes: number }>): [number, number] | undefined {
	return getCountDomain(points.map(point => point.bytes));
}
