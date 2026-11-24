import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	getCompiledFunctionForCodeBlock,
	getCompiledModuleForCodeBlock,
	getCurrentCompiledLineForCodeBlock,
} from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryTarget } from '@8f4e/editor-state/memory';
import type { CodeBlockLayoutsChangedEvent } from '@8f4e/editor-state-types';
import { getSelectedLineTooltipContent } from '../helpers/content';
import { describeSourceLine } from '../helpers/sourceLine';
import { createEmptyTooltipState, getTooltipState } from './layout';

/**
 * Coalesces tooltip invalidations and prepares from settled inputs before drawing.
 */
export default function createTooltip(
	store: Pick<EditorPluginContext['store'], 'getState' | 'subscribe' | 'unsubscribe'>,
	events: EditorPluginContext['events']
) {
	let tooltip = createEmptyTooltipState();
	let invalidatedAt: number | undefined;
	let scheduled = false;
	const state = store.getState();

	function prepareSelectedLineTooltip(now: number): void {
		const selectedCodeBlock = state.project.selectedCodeBlock;

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
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip, now);
	}

	const prepareIfDirty = () => {
		if (invalidatedAt === undefined) return;
		const now = invalidatedAt;
		invalidatedAt = undefined;
		prepareSelectedLineTooltip(now);
	};
	const invalidate = () => {
		invalidatedAt = performance.now();
		if (scheduled) return;
		scheduled = true;
		// Source settlement, revision notifications and the caret update can all
		// invalidate the same tooltip within one synchronous operation.
		queueMicrotask(() => {
			scheduled = false;
			prepareIfDirty();
		});
	};
	const onLayoutsChanged = ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		const selected = state.project.selectedCodeBlock;
		if (
			state.featureFlags.codeLineSelection &&
			selected &&
			codeBlocks.includes(selected) &&
			selected.cursor.y !== tooltip.layout.y
		) {
			invalidate();
		}
	};

	const selectors = [
		'project.selectedCodeBlock',
		'projectChange',
		'featureFlags.codeLineSelection',
		'compiler.result',
		'compilerInputRevision',
		'viewport.vGrid',
		'viewport.hGrid',
	] as const;
	for (const selector of selectors) store.subscribe(selector, invalidate);
	events.on('gridSizeChanged', invalidate);
	events.on('codeBlockLayoutsChanged', onLayoutsChanged);
	invalidate();
	return {
		getState: () => {
			// Explicit synchronous frames must also see the latest settled inputs.
			prepareIfDirty();
			return tooltip;
		},
		dispose: () => {
			events.off('codeBlockLayoutsChanged', onLayoutsChanged);
			events.off('gridSizeChanged', invalidate);
			for (const selector of selectors) store.unsubscribe(selector, invalidate);
			invalidatedAt = undefined;
		},
	};
}
