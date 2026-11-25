import { wrapText } from '@8f4e/editor-state';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { TOOLTIP_WRAP_WIDTH } from './constants';

/**
 * Wraps tooltip copy to the configured monospace character width.
 */
export function wrapTooltipText(text: string, maxLength = TOOLTIP_WRAP_WIDTH): string[] {
	return wrapText(text, maxLength);
}

/**
 * Converts tooltip lines into drawer character arrays.
 */
export function getTooltipTextCharacters(text: string[]): GlyphIds[] {
	return text.map(textToGlyphIds);
}

/**
 * Returns the widest tooltip line in monospace character cells.
 */
export function getMaxLineLength(lines: string[]): number {
	let maxLineLength = 0;

	for (let index = 0; index < lines.length; index++) {
		maxLineLength = Math.max(maxLineLength, lines[index].length);
	}

	return maxLineLength;
}
