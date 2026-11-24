import type { EditorCodeBlock, ProjectEditOptions, ProjectTransactions } from '@8f4e/editor-state-types';

/**
 * Apply replacement source as one project edit. Callers own edit-mode policy.
 */
export function applyCodeBlockSourceEdits(
	store: { projectTransactions: ProjectTransactions },
	edits: readonly { codeBlock: EditorCodeBlock; code: readonly string[] }[],
	options?: ProjectEditOptions
): boolean {
	return store.projectTransactions.apply({ updates: edits }, options).changed;
}
