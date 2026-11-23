import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	getCompiledFunctionForCodeBlock,
	getCompiledModuleForCodeBlock,
	getCurrentCompiledLineForCodeBlock,
} from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryTarget } from '@8f4e/editor-state/memory';
import { getSelectedLineTooltipContent } from '../helpers/content';
import { describeSourceLine } from '../helpers/sourceLine';
import { createEmptyTooltipState, getTooltipState } from './layout';

/**
 * Keeps plugin-owned tooltip state synchronized with the selected code line.
 */
export default function createTooltip(
	store: Pick<EditorPluginContext['store'], 'getState' | 'subscribe' | 'unsubscribe'>,
	events: EditorPluginContext['events']
) {
	let tooltip = createEmptyTooltipState();
	const state = store.getState();

	function syncSelectedLineTooltip(): void {
		const selectedCodeBlock = state.codeBlockRendering.selectedCodeBlock;

		if (!state.featureFlags.codeLineSelection || !selectedCodeBlock) {
			tooltip = createEmptyTooltipState();
			return;
		}

		const source = describeSourceLine(selectedCodeBlock.code[selectedCodeBlock.cursor.row]);
		const module =
			selectedCodeBlock.name && selectedCodeBlock.blockType !== 'function'
				? getCompiledModuleForCodeBlock(selectedCodeBlock, state)
				: undefined;
		const compiledLine = getCurrentCompiledLineForCodeBlock(selectedCodeBlock, state);
		const resolvedCall = compiledLine?.stackAnalysisLine?.resolvedCall;
		const documentedFunction = resolvedCall
			? state.compiler.result.compiledFunctions?.[resolvedCall.targetFunctionId]
			: selectedCodeBlock.blockType === 'function' && compiledLine?.parsedLine
				? getCompiledFunctionForCodeBlock(selectedCodeBlock, state)
				: undefined;
		const memoryTarget =
			module && source.declaration
				? resolveMemoryTarget(state, getCodeBlockMemoryScope(selectedCodeBlock), source.declaration.id)
				: undefined;
		const content = getSelectedLineTooltipContent({
			source,
			parsedLine: compiledLine?.parsedLine,
			stackAnalysisLine: compiledLine?.stackAnalysisLine,
			functionDocumentation: documentedFunction?.ast.documentation,
			target: memoryTarget,
			moduleExecutionOrder: source.sourceInstruction?.instruction === 'module' && module ? module.index + 1 : undefined,
		});
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip);
	}

	const selectors = [
		'codeBlockRendering.selectedCodeBlock',
		'projectChange',
		'featureFlags.codeLineSelection',
		'compiler.result',
		'compilerInputRevision',
		'viewport.vGrid',
		'viewport.hGrid',
	] as const;
	for (const selector of selectors) store.subscribe(selector, syncSelectedLineTooltip);
	events.on('gridSizeChanged', syncSelectedLineTooltip);
	syncSelectedLineTooltip();
	return {
		getState: () => tooltip,
		dispose: () => {
			events.off('gridSizeChanged', syncSelectedLineTooltip);
			for (const selector of selectors) store.unsubscribe(selector, syncSelectedLineTooltip);
		},
	};
}
