import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../project-changes';

/** Refresh changed source blocks, then announce the completed batch once. Callers own edit-mode policy. */
export function applyCodeBlockSourceEdits(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	edits: readonly { codeBlock: CodeBlockGraphicData; code: string[] }[],
	{ affectsCompilation }: { affectsCompilation: boolean }
): boolean {
	let changed = false;
	for (const { codeBlock, code } of edits) {
		if (code.length === codeBlock.code.length && code.every((line, index) => line === codeBlock.code[index])) continue;
		codeBlock.code = code;
		codeBlock.lastUpdated = Date.now();
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
		changed = true;
	}
	if (!changed) return false;
	if (affectsCompilation) incrementCompilerInputRevision(store);
	publishProjectChange(store);
	return true;
}
