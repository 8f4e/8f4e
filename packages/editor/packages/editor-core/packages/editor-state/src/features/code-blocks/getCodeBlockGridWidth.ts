import { getTabStopsByLine, getVisualLineWidth } from '../text-geometry/tabLayout';
import { CODE_BLOCK_MIN_GRID_WIDTH } from './utils/constants';

/**
 * Computes the grid width required for a code block.
 * Matches the sizing logic used by codeBlockRendering effect.
 *
 * @param code - Code block represented as an array of lines
 * @param minGridWidth - Minimum grid width (defaults to CODE_BLOCK_MIN_GRID_WIDTH)
 * @returns The grid width in grid units
 */
export default function getCodeBlockGridWidth(code: string[], minGridWidth = CODE_BLOCK_MIN_GRID_WIDTH): number {
	// Calculate line number column width
	const lineNumberColumnWidth = code.length.toString().length;
	const tabStopsByLine = getTabStopsByLine(code);

	// Prepare code with line numbers (matching codeBlockRendering logic)
	const codeWithLineNumbers = code.map((line, index) => {
		const prefix = `${index}`.padStart(lineNumberColumnWidth, '0') + ' ';
		return prefix.length + getVisualLineWidth(line, tabStopsByLine[index] || []);
	});

	// Calculate width: max(minGridWidth, longestLine + 4 padding)
	return Math.max(minGridWidth, Math.max(...codeWithLineNumbers, 0) + 4);
}
