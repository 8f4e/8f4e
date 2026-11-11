import type { EditorPluginContext } from '@8f4e/editor-core';
import { getCompiledFunctionForCodeBlock, getCompiledModuleForCodeBlock } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryTarget } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { getSelectedLineTooltipContent } from '../helpers/content';
import { describeSourceLine } from '../helpers/sourceLine';
import { createEmptyTooltipState, getTooltipState } from './layout';

/**
 * Keeps plugin-owned tooltip state synchronized with the selected code line.
 */
export default function createTooltip(store: EditorPluginContext['store'], events: EditorPluginContext['events']) {
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
		const compilation =
			selectedCodeBlock.name && selectedCodeBlock.blockType === 'function'
				? getCompiledFunctionForCodeBlock(selectedCodeBlock, state)
				: module;
		const memoryTarget =
			module && source.declaration
				? resolveMemoryTarget(state, getCodeBlockMemoryScope(selectedCodeBlock), source.declaration.id)
				: undefined;
		const content = getSelectedLineTooltipContent({
			source,
			parsedLine: compilation?.ast.lines.find(line => line.lineNumber === selectedCodeBlock.cursor.row),
			stackAnalysisLine: compilation?.stackAnalysis?.find(line => line.lineNumber === selectedCodeBlock.cursor.row),
			target: memoryTarget,
			moduleExecutionOrder: source.sourceInstruction?.instruction === 'module' && module ? module.index + 1 : undefined,
		});
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip);
	}

	const selectors = [
		'codeBlockRendering.selectedCodeBlock',
		'codeBlockRendering.currentProject.blocks',
		'featureFlags.codeLineSelection',
		'compiler',
		'viewport.vGrid',
		'viewport.hGrid',
	] as const;
	for (const selector of selectors) store.subscribe(selector, syncSelectedLineTooltip);
	const onSourcesChanged = ({ codeBlocks }: { codeBlocks: readonly CodeBlockGraphicData[] }) => {
		if (state.codeBlockRendering.selectedCodeBlock && codeBlocks.includes(state.codeBlockRendering.selectedCodeBlock))
			syncSelectedLineTooltip();
	};
	events.on('codeBlockSourcesChanged', onSourcesChanged);
	events.on('gridSizeChanged', syncSelectedLineTooltip);
	syncSelectedLineTooltip();
	return {
		getState: () => tooltip,
		dispose: () => {
			events.off('codeBlockSourcesChanged', onSourcesChanged);
			events.off('gridSizeChanged', syncSelectedLineTooltip);
			for (const selector of selectors) store.unsubscribe(selector, syncSelectedLineTooltip);
		},
	};
}
