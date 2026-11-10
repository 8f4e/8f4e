import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	getCompiledFunctionForCodeBlock,
	getCompiledModuleForCodeBlock,
	getModuleCompilationForCodeBlock,
} from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { createProjectModuleId } from '@8f4e/language-spec';
import { getSelectedLineTooltipContent } from '../helpers/content';
import {
	getInstructionNameFromSourceLine,
	getMemoryDeclarationIdFromSourceLine,
	getReferenceDeclarationIdFromSourceLine,
} from '../helpers/sourceLine';
import { createEmptyTooltipState, getTooltipState } from './layout';

/**
 * Finds compiler metadata for the selected source block's active definition.
 */
function getSelectedCodeBlockCompilation(state: State, selectedCodeBlock: CodeBlockGraphicData) {
	if (!selectedCodeBlock.name) {
		return undefined;
	}

	if (selectedCodeBlock.blockType === 'function') {
		return getCompiledFunctionForCodeBlock(selectedCodeBlock, state);
	}

	return getCompiledModuleForCodeBlock(selectedCodeBlock, state);
}

/**
 * Resolves memory metadata for selected memory declaration tooltip rows.
 */
function getSelectedMemoryDeclaration(state: State, codeBlock: CodeBlockGraphicData, memoryId: string | undefined) {
	if (!codeBlock.name || !memoryId) {
		return undefined;
	}

	return getModuleCompilationForCodeBlock(codeBlock, state)?.plannedModule.memory[memoryId];
}

function getSelectedModuleExecutionOrder(
	state: State,
	selectedCodeBlock: CodeBlockGraphicData,
	line: string | undefined
): number | undefined {
	if (!line || getInstructionNameFromSourceLine(line) !== 'module' || !selectedCodeBlock.name) {
		return undefined;
	}

	const module = getCompiledModuleForCodeBlock(selectedCodeBlock, state);
	return module ? module.index + 1 : undefined;
}

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

		const line = selectedCodeBlock.code[selectedCodeBlock.cursor.row];
		const memoryId = getMemoryDeclarationIdFromSourceLine(line);
		const referenceId = getReferenceDeclarationIdFromSourceLine(line);
		const compilation = getSelectedCodeBlockCompilation(state, selectedCodeBlock);
		const content = getSelectedLineTooltipContent({
			line,
			parsedLine: compilation?.ast.lines.find(line => line.lineNumber === selectedCodeBlock.cursor.row),
			stackAnalysisLine: compilation?.stackAnalysis?.find(line => line.lineNumber === selectedCodeBlock.cursor.row),
			moduleId: createProjectModuleId(selectedCodeBlock.projectPath, selectedCodeBlock.name),
			memory: getSelectedMemoryDeclaration(state, selectedCodeBlock, memoryId),
			reference: referenceId
				? getCompiledModuleForCodeBlock(selectedCodeBlock, state)?.referenceSlots?.[referenceId]
				: undefined,
			moduleExecutionOrder: getSelectedModuleExecutionOrder(state, selectedCodeBlock, line),
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
