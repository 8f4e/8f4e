export function renderSummaryItem(label: string, value: string, meta: string) {
	return `
		<article class="summary-item">
			<span>${escapeHtml(label)}</span>
			<strong>${escapeHtml(value)}</strong>
			<small>${escapeHtml(meta)}</small>
		</article>
	`;
}

export function debounce(callback: () => void, waitMs: number) {
	let timeout: number | undefined;

	return () => {
		window.clearTimeout(timeout);
		timeout = window.setTimeout(callback, waitMs);
	};
}

export function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function requireElement<TElement extends Element>(selector: string, parent: ParentNode = document) {
	const element = parent.querySelector<TElement>(selector);

	if (!element) {
		throw new Error(`Missing element: ${selector}`);
	}

	return element;
}

/** Render the common report card structure; each report owns its data and chart. */
export function renderReportCards<TLog extends { label: string }, TPoint>(
	grid: HTMLElement,
	logs: TLog[],
	options: {
		selectPoints: (log: TLog) => TPoint[];
		summary: (points: TPoint[]) => { meta: string; value: string };
		renderTable?: (points: TPoint[]) => string;
		chart: (container: HTMLElement, points: TPoint[]) => SVGSVGElement | HTMLElement;
	}
) {
	grid.replaceChildren();

	for (const log of logs) {
		const points = options.selectPoints(log);
		const { meta, value } = options.summary(points);
		const card = document.createElement('article');
		card.className = 'package-card';
		card.innerHTML = `
			<div class="package-card-header">
				<div>
					<h3>${escapeHtml(log.label)}</h3>
					<p>${escapeHtml(meta)}</p>
				</div>
				<strong>${escapeHtml(value)}</strong>
			</div>
			<div class="package-card-chart"></div>
			${options.renderTable?.(points) ?? ''}
		`;

		grid.append(card);
		const chartContainer = card.querySelector<HTMLElement>('.package-card-chart');
		if (chartContainer) {
			chartContainer.replaceChildren(options.chart(chartContainer, points));
		}
	}
}
