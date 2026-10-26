import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import gapCalculator from '~/features/code-editing/gapCalculator';
import parseCodeBlocks from './codeParser';

const HIGHLIGHT_COLORS = ['surfaceRaised1', 'surfaceRaised2', 'surfaceRaised3'] as const;

export default function (graphicData: CodeBlockGraphicData, state: State) {
	graphicData.widgets.blockHighlights = [];
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

		graphicData.widgets.blockHighlights.push({
			x: state.viewport.vGrid * (2 + graphicData.lineNumberColumnWidth),
			y: gapCalculator(highlightStartLine, graphicData.gaps) * state.viewport.hGrid,
			width: graphicData.width - state.viewport.vGrid * (2 + graphicData.lineNumberColumnWidth),
			height: (highlightEndLine - highlightStartLine + 1) * state.viewport.hGrid,
			color: HIGHLIGHT_COLORS[block.depth % HIGHLIGHT_COLORS.length],
		});
	});
}
