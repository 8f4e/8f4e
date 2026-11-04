import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import compareCodeBlocksByPosition from '../../pureHelpers/compareCodeBlocksByPosition';
import deepEqual from '../../shared/utils/deepEqual';
import { resolveEditorConfigEntries, validateEditorConfigEntries } from '../editor-config/validators';
import { resolveGlobalEditorDirectives } from './registry';

function collectProjectCodeBlocks(codeBlocks: CodeBlockGraphicData[]): CodeBlockGraphicData[] {
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
export default function resolveEditorConfig(store: Pick<StateManager<State>, 'getState' | 'set'>): void {
	const state = store.getState();
	const projectCodeBlocks = collectProjectCodeBlocks(state.codeBlockRendering.rootProject.blocks);
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
