import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import parsePos from '../features/code-blocks/features/directives/pos/data';
import { hasDirective } from '../features/code-blocks/features/directives/utils';
import { findProjectSlicePath } from '../features/code-blocks/features/projectGroupNavigation/effect';
import getBlockType from '../features/code-blocks/utils/codeParsers/getBlockType';
import { createCodeBlockGraphicData } from '../features/code-blocks/utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from '../features/code-blocks/utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '../features/code-blocks/utils/parseBlockDirectives';
import updateViewport from '../features/viewport/updateViewport';
import serializeCodeBlocks from '../pureHelpers/projectSerialization/serializeCodeBlocks';
import { type EditorEdit, EditorEditingError, type EditorEditingHandle, type EditorNavigationHandle } from './types';

export * from './types';

function flatten(blocks: CodeBlockGraphicData[]): CodeBlockGraphicData[] {
	return blocks.flatMap(block => [block, ...flatten(block.nestedProjectCodeBlocks ?? [])]);
}

function copyBlocks(blocks: CodeBlockGraphicData[]): CodeBlockGraphicData[] {
	return blocks.map(block => ({
		...block,
		code: [...block.code],
		...(block.nestedProjectCodeBlocks === undefined
			? {}
			: { nestedProjectCodeBlocks: copyBlocks(block.nestedProjectCodeBlocks) }),
	}));
}

/** Command handle for a block read directly from editor state. */
export const getEditorBlockId = (block: CodeBlockGraphicData): string =>
	JSON.stringify([block.projectPath, block.creationIndex]);
let nextEditorInstance = 0;

function findSlice(blocks: CodeBlockGraphicData[], path: string, currentPath = ''): CodeBlockGraphicData[] | undefined {
	if (path === currentPath) return blocks;
	for (const block of blocks) {
		if (block.nestedProjectCodeBlocks === undefined) continue;
		const result = findSlice(block.nestedProjectCodeBlocks, path, createChildProjectGroupPath(currentPath, block.name));
		if (result) return result;
	}
}

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
			const draft = copyBlocks(state.codeBlockRendering.rootCodeBlocks);
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
					const slice = findSlice(draft, path);
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
					slice!.push(block);
					createdBlockIds.push(getEditorBlockId(block));
					continue;
				}
				if (!['update', 'delete'].includes(edit.type)) invalid('Unknown edit type');
				const target = flatten(draft).find(block => getEditorBlockId(block) === edit.blockId);
				if (!target)
					throw new EditorEditingError('block_not_found', 'Read the project for a current blockId', revision());
				if (edit.type === 'delete') {
					const slice = findSlice(draft, target.projectPath)!;
					slice.splice(slice.indexOf(target), 1);
				} else if (edit.type === 'update') {
					validateCode(edit.code);
					if (!target.nestedProjectCodeBlocks && edit.code.some(line => /^\s*group(?:\s|$)/.test(line)))
						invalid('Converting a code block into a project group is not supported');
					validateEntry(edit.entry);
					if (target.nestedProjectCodeBlocks && getCodeBlockNameFromSource(edit.code) !== target.name) {
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
					if (edit.entry !== undefined && target.blockType !== 'module' && !target.nestedProjectCodeBlocks)
						invalid('Only modules and project groups accept an entry');
					if (target.blockType === 'module') target.entry = edit.entry ?? target.entry ?? 'main';
					else if (target.nestedProjectCodeBlocks && edit.entry !== undefined) target.entry = edit.entry;
				}
			}
			const currentPath = findProjectSlicePath(
				state.codeBlockRendering.rootCodeBlocks,
				state.codeBlockRendering.codeBlocks
			);
			const { x, y } = state.viewport;
			events.dispatch('applyProjectEdit', { project: serializeCodeBlocks(draft) });
			const slice = findSlice(state.codeBlockRendering.rootCodeBlocks, currentPath ?? '');
			if (slice && slice !== state.codeBlockRendering.codeBlocks) store.set('codeBlockRendering.codeBlocks', slice);
			updateViewport(state, x, y, events);
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
			const block = flatten(state.codeBlockRendering.rootCodeBlocks).find(block => getEditorBlockId(block) === id);
			if (!block) throw new EditorEditingError('block_not_found', 'Read state for a current group blockId', revision());
			if (block.nestedProjectCodeBlocks === undefined)
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
