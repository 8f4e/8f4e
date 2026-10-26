import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { SpriteLookups, TooltipHighlightRange } from '../types';
import { getStackSignatureFromSourceLine } from './sourceLine';
import { getStackValueHighlightRange } from './stackAnalysisTooltip';

/**
 * Encodes tooltip color transitions as sparse sprite lookups for the drawer.
 */
export function getTooltipLineColors(
	line: string,
	spriteLookups: SpriteLookups | undefined,
	highlightRanges: TooltipHighlightRange[] = []
): Array<PaletteIndex | undefined> {
	if (!spriteLookups || line.length === 0) {
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
	line: string | undefined,
	text: string[],
	spriteLookups: SpriteLookups | undefined
): Array<Array<PaletteIndex | undefined>> {
	const stackSignature = line ? getStackSignatureFromSourceLine(line) : undefined;

	return text.map((tooltipLine, index) => {
		const highlightRange =
			index === 0 && stackSignature === tooltipLine
				? { start: 0, end: tooltipLine.length }
				: getStackValueHighlightRange(tooltipLine);

		return getTooltipLineColors(tooltipLine, spriteLookups, highlightRange ? [highlightRange] : []);
	});
}
