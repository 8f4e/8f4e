import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../project-changes';
import { isOrdinaryCommentLine } from './features/directives/utils';

/**
 * Refresh changed source blocks, then announce the completed batch once. Callers own edit-mode policy.
 * Only in-place edits to ordinary comment text leave compiler inputs unchanged.
 */
export function applyCodeBlockSourceEdits(
	{
		store,
		events,
	}: {
		store: Pick<StateManager<State>, 'getState' | 'set'>;
		events: Pick<EventDispatcher, 'dispatch'>;
	},
	edits: readonly { codeBlock: CodeBlockGraphicData; code: string[] }[]
): boolean {
	const changedBlocks = new Set<CodeBlockGraphicData>();
	let affectsCompilation = false;
	for (const { codeBlock, code } of edits) {
		if (code.length === codeBlock.code.length && code.every((line, index) => line === codeBlock.code[index])) continue;
		if (
			code.length !== codeBlock.code.length ||
			code.some(
				(line, index) =>
					line !== codeBlock.code[index] &&
					(!isOrdinaryCommentLine(line) || !isOrdinaryCommentLine(codeBlock.code[index]))
			)
		) {
			affectsCompilation = true;
		}
		codeBlock.code = code;
		codeBlock.lastUpdated = Date.now();
		changedBlocks.add(codeBlock);
	}
	if (changedBlocks.size === 0) return false;
	events.dispatch('codeBlockSourcesChanged', { codeBlocks: [...changedBlocks] });
	if (affectsCompilation) {
		incrementCompilerInputRevision(store);
	}
	publishProjectChange(store);
	return true;
}
