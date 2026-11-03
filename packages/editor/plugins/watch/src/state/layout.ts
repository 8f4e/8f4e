import { gapCalculator, getTabStopsByLine, getVisualLineWidth, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createWatchDirectiveData } from '../helpers/data';
import type { WatchValue } from '../types';

export function registerWatchLayout(
	layout: EditorLayoutRegistry,
	watchesByBlock: WeakMap<CodeBlockGraphicData, WatchValue[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'watch', aliases: ['w'] }]).flatMap(
			directive => {
				const data = createWatchDirectiveData(directive.args, directive.sourceLineIndex, directive.sourceLine);
				return data ? [data] : [];
			}
		);
		watchesByBlock.set(graphicData, []);
		items.forEach(data => {
			const scope = getCodeBlockMemoryScope(graphicData);
			const resolveMemory = () => resolveMemoryIdentifier(state, scope, data.memoryId);
			const dereferenced = data.memoryId.startsWith('*');
			const memory = dereferenced ? undefined : resolveMemory();
			if (!dereferenced && !memory) {
				return;
			}

			const displayRow = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			const tabStopsByLine = getTabStopsByLine(graphicData.code);
			const visualLineWidth = getVisualLineWidth(
				graphicData.code[data.lineNumber] || '',
				tabStopsByLine[data.lineNumber] || []
			);

			watchesByBlock.get(graphicData)!.push({
				x: state.viewport.vGrid * (3 + graphicData.lineNumberColumnWidth + visualLineWidth),
				y: gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid,
				resolveMemory: dereferenced ? resolveMemory : () => memory,
				showEndAddress: data.showEndAddress,
				displayFormat: data.displayFormat,
			});
		});
	});
	return unsubscribe;
}
