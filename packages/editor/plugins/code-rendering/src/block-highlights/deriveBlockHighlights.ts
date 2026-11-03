import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, Viewport } from '@8f4e/editor-state-types';
import parseCodeBlocks from './codeParser';

const HIGHLIGHT_COLORS = ['surfaceRaised1', 'surfaceRaised2', 'surfaceRaised3'] as const;

interface BlockHighlight {
	x: number;
	y: number;
	width: number;
	height: number;
	color: (typeof HIGHLIGHT_COLORS)[number];
}

export default function deriveBlockHighlights(
	graphicData: CodeBlockGraphicData,
	viewport: Pick<Viewport, 'vGrid' | 'hGrid'>
): BlockHighlight[] {
	const highlights: BlockHighlight[] = [];
	const visibleLineCount = graphicData.displayModel.lines.filter(line => !line.isPlaceholder).length;
	parseCodeBlocks(graphicData.code).forEach(block => {
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
