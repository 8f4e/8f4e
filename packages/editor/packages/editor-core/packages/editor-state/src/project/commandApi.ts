import type {
	EditorCodeBlock,
	EventDispatcher,
	ProjectEditPlan,
	ProjectTransactions,
	State,
} from '@8f4e/editor-state-types';
import { projectInstructions } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { instructionParser, isProjectGapLine } from '@8f4e/tokenizer';
import getCodeBlockNameFromSource from './blocks/getCodeBlockNameFromSource';
import getCodeBlockTypeFromSource from './blocks/getCodeBlockTypeFromSource';
import {
	type EditorEdit,
	EditorEditingError,
	type EditorEditingHandle,
	type EditorNavigationHandle,
} from './commandApiTypes';
import { ProjectEditPlanError } from './transactions';
import { walkProjectBlocks } from './tree';

export * from './commandApiTypes';

/** Command handle for a block read directly from editor state. */
export const getEditorBlockId = (block: EditorCodeBlock): string =>
	JSON.stringify([block.projectPath, block.creationIndex]);
let nextEditorInstance = 0;

type EditingStore = Pick<StateManager<State>, 'getState'> & { projectTransactions: ProjectTransactions };

/** Resolve public revision-checked commands into one project mutation, without replacing the live tree. */
export function createEditorCommandApi(store: EditingStore, events: EventDispatcher) {
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
	function invalid(message: string): never {
		throw new EditorEditingError('invalid_edit', message, revision());
	}
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
	const isGroupSource = (code: string[]) => {
		const opener = code.find(line => !isProjectGapLine(line))?.match(instructionParser)?.[1];
		return opener === projectInstructions.group.opener;
	};
	// Entry membership is command metadata, distinct from validation of the source itself.
	const acceptsEntry = (code: string[]) => getCodeBlockTypeFromSource(code) === 'module';
	const handle: EditorEditingHandle = {
		getRevision() {
			assertAlive();
			return revision();
		},
		applyEdits({ expectedRevision, edits }) {
			checkWrite(expectedRevision);
			if (!Array.isArray(edits) || edits.length === 0) invalid('Provide at least one edit');
			const root = state.project.rootLevel;
			const targets = new Map([...walkProjectBlocks(root)].map(block => [getEditorBlockId(block), block]));
			const inserts: NonNullable<ProjectEditPlan['inserts']>[number][] = [];
			const updates: NonNullable<ProjectEditPlan['updates']>[number][] = [];
			const deletes: EditorCodeBlock[] = [];
			for (const edit of edits as readonly EditorEdit[]) {
				if (!edit || typeof edit !== 'object') invalid('Invalid edit');
				if (edit.type === 'insert') {
					validateCode(edit.code);
					if (isGroupSource(edit.code))
						invalid('Create project groups through project loading; inserts add ordinary code blocks');
					validateEntry(edit.entry);
					let project = root;
					if (edit.groupBlockId !== undefined) {
						const group = targets.get(edit.groupBlockId);
						if (!group)
							throw new EditorEditingError(
								'block_not_found',
								'Read the project for a current groupBlockId',
								revision()
							);
						if (!group.childProject) invalid('The insertion target is not a project group');
						project = group.childProject;
					}
					if (edit.entry !== undefined && !acceptsEntry(edit.code)) invalid('Only module inserts accept an entry');
					inserts.push({ project, source: { code: edit.code, entry: edit.entry } });
					continue;
				}
				if (!['update', 'delete'].includes(edit.type)) invalid('Unknown edit type');
				const target = targets.get(edit.blockId);
				if (!target)
					throw new EditorEditingError('block_not_found', 'Read the project for a current blockId', revision());
				if (edit.type === 'delete') {
					deletes.push(target);
				} else if (edit.type === 'update') {
					validateCode(edit.code);
					if (!target.childProject && isGroupSource(edit.code))
						invalid('Converting a code block into a project group is not supported');
					validateEntry(edit.entry);
					if (target.childProject && getCodeBlockNameFromSource(edit.code) !== target.name) {
						invalid('Keep the project group name when updating its source; edit child blocks through their handles');
					}
					if (edit.entry !== undefined && !target.childProject && !acceptsEntry(edit.code))
						invalid('Only modules and project groups accept an entry');
					updates.push({
						codeBlock: target,
						code: edit.code,
						entry: edit.entry,
					});
				}
			}
			try {
				const { insertedBlocks } = store.projectTransactions.apply(
					{ updates, inserts, deletes },
					{ history: 'checkpoint' }
				);
				return { revision: revision(), createdBlockIds: insertedBlocks.map(getEditorBlockId) };
			} catch (error) {
				if (error instanceof ProjectEditPlanError) invalid(error.message);
				throw error;
			}
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
			const block = [...walkProjectBlocks(state.project.rootLevel)].find(block => getEditorBlockId(block) === id);
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
