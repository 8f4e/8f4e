import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { TooltipHighlightRange } from '../types';
import { getStackValueHighlightRange } from './stackAnalysisTooltip';

/**
 * Encodes tooltip color transitions as sparse palette transitions for the drawer.
 */
export function getTooltipLineColors(
	line: string,
	highlightRanges: TooltipHighlightRange[] = []
): Array<PaletteIndex | undefined> {
	if (line.length === 0) {
		return [];
	}

	const colors: Array<PaletteIndex | undefined> = new Array(line.length).fill(undefined);
	colors[0] = PALETTE_INDICES.inverseInk;

	for (const range of highlightRanges) {
		colors[range.start] = PALETTE_INDICES.inverseAccent;

		if (range.end < line.length) {
			colors[range.end] = PALETTE_INDICES.inverseInk;
		}
	}

	return colors;
}

/**
 * Computes color transitions for the selected-line tooltip text.
 */
export function getSelectedLineTooltipColors(
	text: string[],
	signatureLineCount: number
): Array<Array<PaletteIndex | undefined>> {
	return text.map((tooltipLine, index) => {
		const highlightRange =
			index < signatureLineCount ? { start: 0, end: tooltipLine.length } : getStackValueHighlightRange(tooltipLine);

		return getTooltipLineColors(tooltipLine, highlightRange ? [highlightRange] : []);
	});
}
