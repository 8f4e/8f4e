import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { resolveEditorConfigEntries, validateEditorConfigEntries } from '../../editor-config/resolveConfigEntries';
import compareCodeBlocksByPosition from '../../project/blocks/compareCodeBlocksByPosition';
import deepEqual from '../../utils/deepEqual';
import { resolveGlobalEditorDirectives } from './resolveGlobalEditorDirectives';

function collectProjectCodeBlocks(codeBlocks: EditorCodeBlock[]): EditorCodeBlock[] {
	return [...codeBlocks]
		.sort(compareCodeBlocksByPosition)
		.flatMap(block => [block, ...(block.childProject ? collectProjectCodeBlocks(block.childProject?.blocks) : [])]);
}

/**
 * Resolve global editor directives after source metadata has been refreshed.
 *
 * Scans the complete recursive project tree in spatial order for global `; @<name>` editor directives and
 * updates `state.globalEditorDirectives` with the resolved values. The rendered project slice
 * is intentionally ignored so navigating into a project group cannot change global state.
 *
 * Conflicting directive values are written to `state.codeErrors['editor-directives']`.
 */
export default function resolveProjectDirectives(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	environment: EditorCodeBlock | undefined
): void {
	const state = store.getState();
	const root = state.project.rootLevel;
	// The generated environment depends on resolved configuration, never the reverse.
	const projectCodeBlocks = collectProjectCodeBlocks(root.blocks.filter(block => block !== environment));
	const { resolved, errors } = resolveGlobalEditorDirectives(projectCodeBlocks);
	const { configEntries, ...globalEditorDirectives } = resolved;
	const nextEditorConfig = resolveEditorConfigEntries(configEntries ?? [], state.editorConfigValidators);
	const nextErrors = [...errors, ...validateEditorConfigEntries(configEntries ?? [], state.editorConfigValidators)];

	if (!deepEqual(globalEditorDirectives, state.globalEditorDirectives)) {
		store.set('globalEditorDirectives', globalEditorDirectives);
	}

	if (!deepEqual(nextEditorConfig, state.editorConfig)) {
		store.set('editorConfig', nextEditorConfig);
	}

	if (!deepEqual(nextErrors, state.codeErrors['editor-directives'])) {
		store.set('codeErrors.editor-directives', nextErrors);
	}
}
