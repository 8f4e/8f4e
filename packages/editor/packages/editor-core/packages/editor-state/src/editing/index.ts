import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import parsePos from '../features/code-blocks/features/directives/pos/data';
import { hasDirective } from '../features/code-blocks/features/directives/utils';
import getBlockType from '../features/code-blocks/utils/codeParsers/getBlockType';
import { createCodeBlockGraphicData } from '../features/code-blocks/utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from '../features/code-blocks/utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '../features/code-blocks/utils/parseBlockDirectives';
import serializeProjectLevel from '../pureHelpers/projectSerialization/serializeProjectLevel';
import { copyProjectLevel, findProjectLevel, walkProjectBlocks } from '../pureHelpers/projectTree';
import { type EditorEdit, EditorEditingError, type EditorEditingHandle, type EditorNavigationHandle } from './types';

export * from './types';

/** Command handle for a block read directly from editor state. */
export const getEditorBlockId = (block: CodeBlockGraphicData): string =>
	JSON.stringify([block.projectPath, block.creationIndex]);
let nextEditorInstance = 0;

/** Public commands reuse project restoration, without dispatching an unrelated loadProject. */
export function createEditorEditingHandle(store: StateManager<State>, events: EventDispatcher) {
	const state = store.getState();
	const instance = `${++nextEditorInstance}-${Math.random().toString(36).slice(2)}`;
	let disposed = false;
	const revision = () => `${instance}:${state.projectChange.revision}`;
	const assertAlive = () => {
		if (disposed) throw new EditorEditingError('disposed', 'This editor has been disposed');
	};
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		events.off('dispose', dispose);
	};
	events.on('dispose', dispose);
	const checkWrite = (expectedRevision: string) => {
		assertAlive();
		if (expectedRevision !== revision()) {
			throw new EditorEditingError('stale_revision', 'Read state and getRevision again before editing', revision());
		}
		if (state.editorMode !== 'edit')
			throw new EditorEditingError(
				'read_only',
				'The editor is in view mode; switch to edit mode before editing',
				revision()
			);
	};
	const invalid = (message: string): never => {
		throw new EditorEditingError('invalid_edit', message, revision());
	};
	const validateCode = (code: string[]) => {
		if (
			!Array.isArray(code) ||
			code.length === 0 ||
			code.some(line => typeof line !== 'string' || /[\r\n]/.test(line))
		) {
			invalid('code must be a nonempty array of individual source lines');
		}
	};
	const validateEntry = (entry: string | undefined) => {
		if (entry !== undefined && (typeof entry !== 'string' || !/^\S+$/.test(entry)))
			invalid('entry must be a nonempty name');
	};
	const handle: EditorEditingHandle = {
		getRevision() {
			assertAlive();
			return revision();
		},
		applyEdits({ expectedRevision, edits }) {
			checkWrite(expectedRevision);
			if (!Array.isArray(edits) || edits.length === 0) invalid('Provide at least one edit');
			const draft = copyProjectLevel(state.codeBlockRendering.rootProject);
			let nextId = state.codeBlockRendering.nextCodeBlockCreationIndex;
			const createdBlockIds: string[] = [];
			for (const edit of edits as readonly EditorEdit[]) {
				if (!edit || typeof edit !== 'object') invalid('Invalid edit');
				if (edit.type === 'insert') {
					validateCode(edit.code);
					if (edit.code.some(line => /^\s*group(?:\s|$)/.test(line)))
						invalid('Create project groups through project loading; inserts add ordinary code blocks');
					validateEntry(edit.entry);
					const path = edit.projectPath ?? '';
					const slice = findProjectLevel(draft, path);
					if (!slice) invalid('Unknown projectPath');
					const code = [...edit.code];
					const pos = parsePos(parseBlockDirectives(code));
					const type = getBlockType(code);
					if (edit.entry !== undefined && type !== 'module') invalid('Only module inserts accept an entry');
					const block = createCodeBlockGraphicData({
						creationIndex: nextId++,
						code,
						projectPath: path,
						blockType: type,
						gridX: pos?.x ?? 0,
						gridY: pos?.y ?? 0,
						entry: type === 'module' ? (edit.entry ?? 'main') : undefined,
						disabled: hasDirective(code, 'disabled'),
					});
					slice!.blocks.push(block);
					createdBlockIds.push(getEditorBlockId(block));
					continue;
				}
				if (!['update', 'delete'].includes(edit.type)) invalid('Unknown edit type');
				const target = [...walkProjectBlocks(draft)].find(block => getEditorBlockId(block) === edit.blockId);
				if (!target)
					throw new EditorEditingError('block_not_found', 'Read the project for a current blockId', revision());
				if (edit.type === 'delete') {
					const slice = findProjectLevel(draft, target.projectPath)!;
					slice.blocks.splice(slice.blocks.indexOf(target), 1);
				} else if (edit.type === 'update') {
					validateCode(edit.code);
					if (!target.childProject && edit.code.some(line => /^\s*group(?:\s|$)/.test(line)))
						invalid('Converting a code block into a project group is not supported');
					validateEntry(edit.entry);
					if (target.childProject && getCodeBlockNameFromSource(edit.code) !== target.name) {
						invalid('Keep the project group name when updating its source; edit child blocks through their handles');
					}
					const pos = parsePos(parseBlockDirectives(edit.code));
					target.code = [...edit.code];
					if (pos) {
						target.gridX = pos.x;
						target.gridY = pos.y;
					}
					target.blockType = getBlockType(target.code);
					if (target.blockType !== 'unknown') target.isProjectScope = false;
					target.disabled = hasDirective(target.code, 'disabled');
					if (edit.entry !== undefined && target.blockType !== 'module' && !target.childProject)
						invalid('Only modules and project groups accept an entry');
					if (target.blockType === 'module') target.entry = edit.entry ?? target.entry ?? 'main';
					else if (target.childProject && edit.entry !== undefined) target.entry = edit.entry;
				}
			}
			events.dispatch('applyProjectEdit', { project: serializeProjectLevel(draft) });
			return { revision: revision(), createdBlockIds };
		},
		undo({ expectedRevision }) {
			checkWrite(expectedRevision);
			events.dispatch('undo');
			return { revision: revision() };
		},
		redo({ expectedRevision }) {
			checkWrite(expectedRevision);
			events.dispatch('redo');
			return { revision: revision() };
		},
	};
	const navigation: EditorNavigationHandle = {
		openGroup(id) {
			assertAlive();
			const block = [...walkProjectBlocks(state.codeBlockRendering.rootProject)].find(
				block => getEditorBlockId(block) === id
			);
			if (!block) throw new EditorEditingError('block_not_found', 'Read state for a current group blockId', revision());
			if (block.childProject === undefined)
				throw new EditorEditingError('invalid_edit', 'The selected block is not a project group', revision());
			events.dispatch('openProjectGroup', { codeBlock: block });
		},
		goToParentGroup() {
			assertAlive();
			events.dispatch('goToParentProjectGroup');
		},
		goToRoot() {
			assertAlive();
			events.dispatch('goToRootProjectGroup');
		},
	};
	return { handle, navigation, dispose };
}
