import { getTabAdvance } from '@8f4e/editor-state';

export function expandLineToCells(line: string, tabStops: number[]): Array<number> {
	const cells: Array<number> = [];
	let visualColumn = 0;
	for (let index = 0; index < line.length; index += 1) {
		if (line[index] === '\t') {
			const advance = getTabAdvance(visualColumn, tabStops);
			cells.push(0x2192, ...new Array(advance - 1).fill(32));
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
			colors.push(rawColors[index], ...new Array(advance - 1).fill(undefined));
			visualColumn += advance;
		} else {
			colors.push(rawColors[index]);
			visualColumn += 1;
		}
	}
	return colors;
}
