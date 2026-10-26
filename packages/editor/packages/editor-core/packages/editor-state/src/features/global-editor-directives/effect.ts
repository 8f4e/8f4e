import type { CodeBlockGraphicData, CodeError, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import deepEqual from '../../shared/utils/deepEqual';
import { resolveEditorConfigEntries, validateEditorConfigEntries } from '../editor-config/validators';
import { globalEditorDirectiveDefinitions, resolveGlobalEditorDirectives } from './registry';
import { parseGlobalEditorDirectives } from './utils';

const GLOBAL_EDITOR_DIRECTIVES_ERROR_OWNER_ID = 'global-editor-directives';

function withOwnerId(errors: CodeError[]): CodeError[] {
	return errors.map(error => ({
		...error,
		ownerId: GLOBAL_EDITOR_DIRECTIVES_ERROR_OWNER_ID,
	}));
}

function collectProjectCodeBlocks(codeBlocks: CodeBlockGraphicData[]): CodeBlockGraphicData[] {
	return codeBlocks.flatMap(codeBlock => [
		codeBlock,
		...(codeBlock.nestedProjectCodeBlocks ? collectProjectCodeBlocks(codeBlock.nestedProjectCodeBlocks) : []),
	]);
}

function getGlobalDirectiveInputs(block: CodeBlockGraphicData) {
	return {
		directives: parseGlobalEditorDirectives(block.parsedDirectives, globalEditorDirectiveDefinitions),
		creationIndex: block.creationIndex,
		name: block.name,
		blockType: block.blockType,
		projectPath: block.projectPath,
	};
}

/**
 * Global-editor-directives effect.
 *
 * Scans the complete recursive project tree for global `; @<name>` editor directives and
 * updates `state.globalEditorDirectives` with the resolved values. The rendered project slice
 * is intentionally ignored so navigating into a project group cannot change global state.
 *
 * Conflicting directive values are written to `state.codeErrors.editorDirectiveErrors`.
 */
export default function globalEditorDirectivesEffect(store: StateManager<State>): void {
	let resolvedInputs = new WeakMap<CodeBlockGraphicData, ReturnType<typeof getGlobalDirectiveInputs>>();

	function resolve(): void {
		const state = store.getState();
		const projectCodeBlocks = collectProjectCodeBlocks(state.codeBlockRendering.rootCodeBlocks);
		resolvedInputs = new WeakMap(projectCodeBlocks.map(block => [block, getGlobalDirectiveInputs(block)]));
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

	function resolveProgrammaticUpdate(): void {
		const block = store.getState().codeBlockRendering.selectedCodeBlockForProgrammaticEdit;
		// Position and other visual metadata updates share this notification but cannot change global configuration.
		if (block && !deepEqual(resolvedInputs.get(block), getGlobalDirectiveInputs(block))) {
			resolve();
		}
	}

	store.subscribe('codeBlockRendering.codeBlocks', resolve);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', resolve);
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', resolveProgrammaticUpdate);
	store.subscribe('editorConfigSchemaContributions', resolve);
}
