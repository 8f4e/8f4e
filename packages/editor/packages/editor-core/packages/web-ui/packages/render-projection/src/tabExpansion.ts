function parseTabDirectiveStops(line: string): number[] | undefined {
	const match = line.match(/^\s*;\s*@tab\s+(.+?)\s*$/);
	if (!match) return undefined;

	const positions = new Set<number>();
	for (const token of match[1].trim().split(/\s+/)) {
		const value = Number.parseInt(token, 10);
		if (!Number.isInteger(value) || value <= 0 || token !== value.toString()) return undefined;
		positions.add(value);
	}
	return [...positions].sort((a, b) => a - b);
}

export function getTabStopsByLine(code: string[]): number[][] {
	let activeTabStops: number[] = [];
	return code.map(line => {
		activeTabStops = parseTabDirectiveStops(line) ?? activeTabStops;
		return activeTabStops;
	});
}

function getTabAdvance(currentVisualColumn: number, tabStops: number[]): number {
	return Math.max(
		(tabStops.find(stop => stop > currentVisualColumn) ?? currentVisualColumn + 1) - currentVisualColumn,
		1
	);
}

export function expandLineToCells(line: string, tabStops: number[]): Array<number> {
	const cells: Array<number> = [];
	let visualColumn = 0;
	for (let index = 0; index < line.length; index += 1) {
		if (line[index] === '\t') {
			const advance = getTabAdvance(visualColumn, tabStops);
			cells.push(9, ...new Array(Math.max(advance - 1, 0)).fill(32));
			visualColumn += advance;
		} else {
			cells.push(line.charCodeAt(index));
			visualColumn += 1;
		}
	}
	return cells;
}

export function expandLineColorsToCells<T>(
	line: string,
	rawColors: Array<T | undefined>,
	tabStops: number[]
): Array<T | undefined> {
	const colors: Array<T | undefined> = [];
	let visualColumn = 0;
	for (let index = 0; index < line.length; index += 1) {
		if (line[index] === '\t') {
			const advance = getTabAdvance(visualColumn, tabStops);
			colors.push(rawColors[index], ...new Array(Math.max(advance - 1, 0)).fill(undefined));
			visualColumn += advance;
		} else {
			colors.push(rawColors[index]);
			visualColumn += 1;
		}
	}
	return colors;
}
