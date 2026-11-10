import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import deepEqual from '../../shared/utils/deepEqual';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../project-changes';

/** Refresh changed source blocks, then announce the completed batch once. Callers own edit-mode policy. */
export function applyCodeBlockSourceEdits(
	{
		store,
		events,
	}: {
		store: Pick<StateManager<State>, 'getState' | 'set'>;
		events: Pick<EventDispatcher, 'dispatch'>;
	},
	edits: readonly { codeBlock: CodeBlockGraphicData; code: string[] }[],
	{ affectsCompilation }: { affectsCompilation: boolean }
): boolean {
	const changedBlocks = new Set<CodeBlockGraphicData>();
	for (const { codeBlock, code } of edits) {
		if (code.length === codeBlock.code.length && code.every((line, index) => line === codeBlock.code[index])) continue;
		codeBlock.code = code;
		codeBlock.lastUpdated = Date.now();
		changedBlocks.add(codeBlock);
	}
	if (changedBlocks.size === 0) return false;
	const state = store.getState();
	const previousConfig = state.editorConfig;
	events.dispatch('codeBlockSourcesChanged', { codeBlocks: [...changedBlocks] });
	if (
		affectsCompilation ||
		(previousConfig !== state.editorConfig &&
			Object.values(state.editorConfigSchemaContributions).some(
				contribution =>
					contribution?.affectsCompilation &&
					!deepEqual(previousConfig[contribution.root], state.editorConfig[contribution.root])
			))
	) {
		incrementCompilerInputRevision(store);
	}
	publishProjectChange(store);
	return true;
}
