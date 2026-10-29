import { gapCalculator, getTabStopsByLine, getVisualLineWidth } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createWatchDirectiveData } from '../helpers/data';
import type { WatchValue } from '../types';

export function createWatchDirective(
	watchesByBlock: WeakMap<CodeBlockGraphicData, WatchValue[]>
): EditorDirectiveDefinition {
	return {
		name: 'watch',
		allowTrailingComment: true,
		aliases: ['w'],
		clearDerivedBlockData: codeBlock => {
			watchesByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createWatchDirectiveData(directive.args, directive.sourceLineIndex, directive.sourceLine);
			if (!data) return;
			draft.layoutCallbacks.push({
				onBlockLayoutReady: (graphicData, state, directiveState) => {
					const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), data.memoryId);
					if (!memory) {
						return;
					}

					const displayRow =
						directiveState.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
					const tabStopsByLine = getTabStopsByLine(graphicData.code);
					const visualLineWidth = getVisualLineWidth(
						graphicData.code[data.lineNumber] || '',
						tabStopsByLine[data.lineNumber] || []
					);

					watchesByBlock.get(graphicData)!.push({
						x: state.viewport.vGrid * (3 + graphicData.lineNumberColumnWidth + visualLineWidth),
						y: gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid,
						memory: memory.memory,
						showAddress: memory.showAddress,
						showEndAddress: data.showEndAddress,
						displayFormat: data.displayFormat,
						bufferPointer: memory.bufferPointer,
					});
				},
			});
		},
	};
}
