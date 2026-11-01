import type { CodeBlockGraphicData, CodeError, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import compareCodeBlocksByPosition from '../../pureHelpers/compareCodeBlocksByPosition';
import deepEqual from '../../shared/utils/deepEqual';
import { resolveEditorConfigEntries, validateEditorConfigEntries } from '../editor-config/validators';
import { resolveGlobalEditorDirectives } from './registry';

const GLOBAL_EDITOR_DIRECTIVES_ERROR_OWNER_ID = 'global-editor-directives';

function withOwnerId(errors: CodeError[]): CodeError[] {
	return errors.map(error => ({
		...error,
		ownerId: GLOBAL_EDITOR_DIRECTIVES_ERROR_OWNER_ID,
	}));
}

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
 * Conflicting directive values are written to `state.codeErrors.editorDirectiveErrors`.
 */
export default function resolveEditorConfig(store: StateManager<State>): void {
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

	const nextOwnedErrors = withOwnerId(nextErrors);
	const currentOwnerErrors = state.codeErrors.editorDirectiveErrors.filter(
		error => error.ownerId === GLOBAL_EDITOR_DIRECTIVES_ERROR_OWNER_ID
	);

	if (!deepEqual(nextOwnedErrors, currentOwnerErrors)) {
		store.set(
			'codeErrors.editorDirectiveErrors',
			state.codeErrors.editorDirectiveErrors
				.filter(error => error.ownerId !== GLOBAL_EDITOR_DIRECTIVES_ERROR_OWNER_ID)
				.concat(nextOwnedErrors)
		);
	}
}
