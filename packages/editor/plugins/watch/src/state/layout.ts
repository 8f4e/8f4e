import { gapCalculator, getTabStopsByLine, getVisualLineWidth, matchEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	getMemoryDeclarationAtSourceLine,
	resolveMemoryAccess,
	resolveMemoryIdentifier,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createWatchDirectiveData } from '../helpers/data';
import type { WatchValue } from '../types';

export function registerWatchLayout(
	layout: EditorLayoutRegistry,
	watchesByBlock: WeakMap<CodeBlockGraphicData, WatchValue[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'watch', aliases: ['w'] }]).map(
			directive => createWatchDirectiveData(directive.args, directive.sourceLineIndex)
		);
		watchesByBlock.set(graphicData, []);
		const scope = getCodeBlockMemoryScope(graphicData);
		items.forEach(data => {
			const declaration = data.inlineAccess && getMemoryDeclarationAtSourceLine(state, graphicData, data.lineNumber);
			if (data.inlineAccess && !declaration) return;
			const resolveMemory = declaration
				? () => resolveMemoryAccess(state, declaration, data.inlineAccess)
				: () => resolveMemoryIdentifier(state, scope, data.memoryId);
			const dereferenced = data.inlineAccess?.dereference ?? data.memoryId?.startsWith('*');
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
