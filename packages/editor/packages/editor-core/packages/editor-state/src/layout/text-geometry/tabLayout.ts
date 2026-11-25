import type { ParsedDirectiveRecord } from '@8f4e/editor-state-types';

function parseTabDirectiveStops(tokens: string[]): number[] | undefined {
	if (tokens.length === 0) {
		return undefined;
	}

	const positions = new Set<number>();
	for (const token of tokens) {
		const value = Number.parseInt(token, 10);
		if (!Number.isInteger(value) || value <= 0 || token !== value.toString()) {
			return undefined;
		}

		positions.add(value);
	}

	return [...positions].sort((a, b) => a - b);
}

/** Derives source-line tab geometry from the central parser's source-ordered directive records. */
export function getTabStopsByLine(lineCount: number, directives: readonly ParsedDirectiveRecord[]): number[][] {
	const tabStopsByLine: number[][] = [];
	let activeTabStops: number[] = [];
	let directiveIndex = 0;

	for (let line = 0; line < lineCount; line++) {
		while (directives[directiveIndex]?.sourceLineIndex === line) {
			const directive = directives[directiveIndex++];
			if (directive.name !== 'tab') continue;
			const parsedStops = parseTabDirectiveStops(directive.args);
			if (parsedStops) activeTabStops = parsedStops;
		}

		tabStopsByLine.push(activeTabStops);
	}

	return tabStopsByLine;
}

export function getTabAdvance(currentVisualColumn: number, tabStops: number[]): number {
	const nextStop = tabStops.find(stop => stop > currentVisualColumn);
	if (nextStop === undefined) {
		return 1;
	}

	return nextStop - currentVisualColumn;
}

export function getVisualColumnForRawIndex(line: string, rawIndex: number, tabStops: number[]): number {
	let visualColumn = 0;
	const boundedRawIndex = Math.max(0, Math.min(rawIndex, line.length));

	for (let i = 0; i < boundedRawIndex; i += 1) {
		visualColumn += line[i] === '\t' ? getTabAdvance(visualColumn, tabStops) : 1;
	}

	return visualColumn;
}

export function getRawIndexForVisualColumn(line: string, visualColumn: number, tabStops: number[]): number {
	const boundedVisualColumn = Math.max(0, visualColumn);
	let currentVisualColumn = 0;

	for (let rawIndex = 0; rawIndex < line.length; rawIndex += 1) {
		if (boundedVisualColumn <= currentVisualColumn) {
			return rawIndex;
		}

		const nextVisualColumn =
			currentVisualColumn + (line[rawIndex] === '\t' ? getTabAdvance(currentVisualColumn, tabStops) : 1);

		if (boundedVisualColumn < nextVisualColumn) {
			return rawIndex + 1;
		}

		currentVisualColumn = nextVisualColumn;
	}

	return line.length;
}

export function getVisualLineWidth(line: string, tabStops: number[]): number {
	return getVisualColumnForRawIndex(line, line.length, tabStops);
}
