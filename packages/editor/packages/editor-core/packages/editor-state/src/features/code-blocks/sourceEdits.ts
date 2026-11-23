import type { CodeBlockGraphicData, ProjectEdits } from '@8f4e/editor-state-types';

/**
 * Apply replacement source as one project edit. Callers own edit-mode policy.
 */
export function applyCodeBlockSourceEdits(
	store: { projectEdits: ProjectEdits },
	edits: readonly { codeBlock: CodeBlockGraphicData; code: readonly string[] }[]
): boolean {
	return store.projectEdits.apply({ updates: edits }).changed;
}
