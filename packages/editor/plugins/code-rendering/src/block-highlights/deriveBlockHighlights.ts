import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, Viewport } from '@8f4e/editor-state-types';
import parseHighlightBlocks from './parseHighlightBlocks';

const HIGHLIGHT_COLORS = [
	PALETTE_INDICES.surfaceRaised1,
	PALETTE_INDICES.surfaceRaised2,
	PALETTE_INDICES.surfaceRaised3,
] as const;

interface BlockHighlight {
	x: number;
	y: number;
	width: number;
	height: number;
	color: PaletteIndex;
}

export default function deriveBlockHighlights(
	graphicData: CodeBlockGraphicData,
	viewport: Pick<Viewport, 'vGrid' | 'hGrid'>
): BlockHighlight[] {
	const highlights: BlockHighlight[] = [];
	const visibleLineCount = graphicData.displayModel.lines.filter(line => !line.isPlaceholder).length;
	parseHighlightBlocks(graphicData.code).forEach(block => {
		if (block.endLineNumber === undefined) {
			return;
		}

		const highlightStartLine = block.startLineNumber + 1;
		const highlightEndLine = Math.min(block.endLineNumber - 1, visibleLineCount - 1);

		if (highlightStartLine > highlightEndLine) {
			return;
		}

		highlights.push({
			x: viewport.vGrid * (2 + graphicData.lineNumberColumnWidth),
			y: gapCalculator(highlightStartLine, graphicData.gaps) * viewport.hGrid,
			width: graphicData.width - viewport.vGrid * (2 + graphicData.lineNumberColumnWidth),
			height: (highlightEndLine - highlightStartLine + 1) * viewport.hGrid,
			color: HIGHLIGHT_COLORS[block.depth % HIGHLIGHT_COLORS.length],
		});
	});
	return highlights;
}
