import type { EditorPluginContext } from '@8f4e/editor-core';
import { getCompiledFunctionForCodeBlock } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryTarget } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompiledStackAnalysisLine } from '@8f4e/language-spec';
import { createProjectModuleId } from '@8f4e/language-spec';
import { TOOLTIP_WRAP_WIDTH } from '../helpers/constants';
import { getSelectedLineTooltipContent } from '../helpers/content';
import { getInstructionNameFromSourceLine, getMemoryDeclarationIdFromSourceLine } from '../helpers/sourceLine';
import { createEmptyTooltipState, getTooltipState } from './layout';

/**
 * Finds stack analysis for the currently selected source line.
 */
function getSelectedCodeBlockStackAnalysisLine(
	state: State,
	selectedCodeBlock: CodeBlockGraphicData
): CompiledStackAnalysisLine | undefined {
	if (!selectedCodeBlock.name) {
		return undefined;
	}

	if (selectedCodeBlock.blockType === 'function') {
		const compiledFunction = getCompiledFunctionForCodeBlock(selectedCodeBlock, state);
		return compiledFunction?.stackAnalysis?.find(line => line.lineNumber === selectedCodeBlock.cursor.row);
	}

	return state.compiler.result.compiledModules[
		createProjectModuleId(selectedCodeBlock.projectPath, selectedCodeBlock.name)
	]?.stackAnalysis?.find(line => line.lineNumber === selectedCodeBlock.cursor.row);
}

/**
 * Resolves memory metadata for selected memory declaration tooltip rows.
 */
function getSelectedMemoryDeclaration(state: State, codeBlock: CodeBlockGraphicData, memoryId: string | undefined) {
	if (!codeBlock.name || !memoryId) {
		return undefined;
	}

	return resolveMemoryTarget(state, getCodeBlockMemoryScope(codeBlock), memoryId)?.memory;
}

function getSelectedModuleExecutionOrder(
	state: State,
	selectedCodeBlock: CodeBlockGraphicData,
	line: string | undefined
): number | undefined {
	if (!line || getInstructionNameFromSourceLine(line) !== 'module' || !selectedCodeBlock.name) {
		return undefined;
	}

	const moduleIndex = Object.keys(state.compiler.result.compiledModules).indexOf(
		createProjectModuleId(selectedCodeBlock.projectPath, selectedCodeBlock.name)
	);
	return moduleIndex === -1 ? undefined : moduleIndex + 1;
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
		const content = getSelectedLineTooltipContent(
			line,
			TOOLTIP_WRAP_WIDTH,
			getSelectedCodeBlockStackAnalysisLine(state, selectedCodeBlock),
			createProjectModuleId(selectedCodeBlock.projectPath, selectedCodeBlock.name),
			getSelectedMemoryDeclaration(state, selectedCodeBlock, memoryId),
			getSelectedModuleExecutionOrder(state, selectedCodeBlock, line)
		);
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip);
	}

	const selectors = [
		'codeBlockRendering.selectedCodeBlock',
		'codeBlockRendering.selectedCodeBlockForProgrammaticEdit',
		'codeBlockRendering.codeBlocks',
		'featureFlags.codeLineSelection',
		'compiler',
		'viewport.vGrid',
		'viewport.hGrid',
	] as const;
	for (const selector of selectors) store.subscribe(selector, syncSelectedLineTooltip);
	events.on('spriteSheetRerendered', syncSelectedLineTooltip);
	syncSelectedLineTooltip();
	return {
		getState: () => tooltip,
		dispose: () => {
			events.off('spriteSheetRerendered', syncSelectedLineTooltip);
			for (const selector of selectors) store.unsubscribe(selector, syncSelectedLineTooltip);
		},
	};
}
