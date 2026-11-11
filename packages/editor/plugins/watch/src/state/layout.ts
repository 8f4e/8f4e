import { gapCalculator, getTabStopsByLine, getVisualLineWidth, matchEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	getMemoryTargetAtSourceLine,
	prepareMemoryAccess,
	resolveMemoryAccess,
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
			const inlineTarget =
				data.inlineAccess && getMemoryTargetAtSourceLine(state, graphicData, data.lineNumber)?.target;
			const prepared = data.inlineAccess
				? inlineTarget && { target: inlineTarget, options: data.inlineAccess }
				: prepareMemoryAccess(state, scope, data.memoryId);
			if (!prepared) return;
			const resolveMemory = () => resolveMemoryAccess(state, prepared.target, prepared.options);
			const runtimePointer = Boolean(
				prepared.options.dereference && !prepared.target.reference && prepared.target.memory.pointeeBaseType
			);
			const memory = runtimePointer ? undefined : resolveMemory();
			if (!runtimePointer && !memory) {
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
				resolveMemory: runtimePointer ? resolveMemory : () => memory,
				showEndAddress: data.showEndAddress,
				displayFormat: data.displayFormat,
			});
		});
	});
	return unsubscribe;
}
