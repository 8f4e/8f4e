import type {
	CodeBlockGraphicData,
	EditorDirectiveDefinition,
	EventDispatcher,
	ProjectEditPlan,
	ProjectEditResult,
	ProjectEdits,
	ProjectLevel,
	ProjectSourceBlock,
	State,
} from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { walkProjectBlocks, walkProjectLevels } from '../../pureHelpers/projectTree';
import {
	clearEnvironmentOwnership,
	findEnvironmentBlock,
	generateEnvironmentSource,
	normalizeEnvironmentSource,
	prepareProjectEnvironmentSource,
} from '../code-blocks/features/auto-env-constants/source';
import { isOrdinaryCommentLine } from '../code-blocks/features/directives/utils';
import type { createLayoutCoordinator } from '../code-blocks/layout/coordinator';
import type { ProjectMembership } from '../code-blocks/projectMembership';
import { reconstructProject } from '../code-blocks/reconstructProject';
import { prepareProjectSources, refreshBlockSources, supportsExecutionEntry } from '../code-blocks/sourceUpdates';
import { createCodeBlockGraphicData } from '../code-blocks/utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from '../code-blocks/utils/getCodeBlockNameFromSource';
import resolveEditorConfig from '../global-editor-directives/resolve';
import {
	cancelPendingProjectViewport,
	placeCurrentProjectViewport,
	rememberCurrentProjectView,
} from '../viewport/updateViewport';

type RestoreKind = 'replace' | 'restore';
type EditKind = 'edit' | 'checkpoint';

/** Internal mutation service; the plugin-facing contract exposes only live edits. */
export interface ProjectEditService extends ProjectEdits {
	restore(project: ProjectObjectModel, kind: RestoreKind): void;
}

interface SourceBefore {
	code: string[];
	entry: string | undefined;
	lastUpdated: number;
}

interface Mutation {
	before: Map<CodeBlockGraphicData, SourceBefore>;
	insertedBlocks: CodeBlockGraphicData[];
	collections: Set<ProjectLevel>;
	placeProject?: ProjectLevel;
	environmentIntent?: string[];
	prepareEnvironment?: boolean;
}

function sameSource(first: readonly string[], second: readonly string[]): boolean {
	return first.length === second.length && first.every((line, index) => line === second[index]);
}

function sourceAffectsCompilation(before: readonly string[], after: readonly string[]): boolean {
	return (
		before.length !== after.length ||
		before.some(
			(line, index) => line !== after[index] && (!isOrdinaryCommentLine(line) || !isOrdinaryCommentLine(after[index]))
		)
	);
}

function rememberSource(mutation: Mutation, block: CodeBlockGraphicData): void {
	if (!mutation.before.has(block)) {
		mutation.before.set(block, { code: block.code, entry: block.entry, lastUpdated: block.lastUpdated });
	}
}

/** Find the surviving visible level if the batch deletes one of its owning groups. */
function survivingProject(
	project: ProjectLevel,
	current: ProjectLevel,
	deletes: ReadonlySet<CodeBlockGraphicData>
): ProjectLevel | undefined {
	if (project === current) return project;
	for (const block of project.blocks) {
		if (!block.childProject) continue;
		const found = survivingProject(block.childProject, current, deletes);
		if (found) return deletes.has(block) ? project : found;
	}
}

/**
 * Own source mutation and settlement. Configuration is derived from authored source;
 * synchronous environment contributions are collected before materializing generated source.
 * Layout and completion events consume the settled blocks, never command source derivation.
 */
export function createProjectEditService(
	store: StateManager<State>,
	events: EventDispatcher,
	directives: EditorDirectiveDefinition[],
	membership: ProjectMembership,
	coordinator: ReturnType<typeof createLayoutCoordinator>
): ProjectEditService {
	const state = store.getState();
	const rendering = state.codeBlockRendering;
	let environment = findEnvironmentBlock(rendering.rootProject);
	let active = false;
	let configPending = false;
	let environmentPending = false;

	const collectChanges = (mutation: Mutation) => {
		const sourceBlocks: CodeBlockGraphicData[] = [];
		let compilation = mutation.collections.size > 0;
		let changed = compilation;
		for (const [block, before] of mutation.before) {
			if (!sameSource(before.code, block.code)) {
				sourceBlocks.push(block);
				changed = true;
				compilation ||= sourceAffectsCompilation(before.code, block.code);
			} else {
				block.code = before.code;
				block.lastUpdated = before.lastUpdated;
			}
			if (before.entry !== block.entry) {
				changed = true;
				compilation = true;
			}
		}
		return { changed, compilation, sourceBlocks };
	};

	const setSource = (mutation: Mutation, block: CodeBlockGraphicData, code: string[]): boolean => {
		if (sameSource(code, block.code)) return false;
		rememberSource(mutation, block);
		block.code = code;
		block.lastUpdated = Date.now();
		return true;
	};

	const materializeEnvironment = (mutation: Mutation) => {
		if (!environment) return;
		const position = { x: environment.gridX, y: environment.gridY };
		const code =
			mutation.environmentIntent || mutation.prepareEnvironment
				? normalizeEnvironmentSource(
						mutation.environmentIntent ?? environment.code,
						state.envConstantContributions,
						position
					)
				: generateEnvironmentSource(state.envConstantContributions, position);
		const changed = setSource(mutation, environment, code);
		if (changed || mutation.prepareEnvironment) {
			refreshBlockSources([environment], directives, membership);
			coordinator.refreshBlocks([environment]);
		}
		mutation.environmentIntent = undefined;
		mutation.prepareEnvironment = false;
	};

	const settlePending = (mutation: Mutation) => {
		// A schema may be registered synchronously while resolving configuration. Only
		// schema changes repeat that phase; generated source cannot feed it back.
		while (configPending) {
			configPending = false;
			resolveEditorConfig(store, environment);
		}
		if (environmentPending) {
			environmentPending = false;
			materializeEnvironment(mutation);
		}
	};

	const publish = (mutation: Mutation, kind: State['projectChange']['kind'], forced = false): boolean => {
		const { changed, compilation, sourceBlocks } = collectChanges(mutation);
		if (!changed && !forced) return false;
		if (sourceBlocks.length) events.dispatch('codeBlockSourcesChanged', { codeBlocks: sourceBlocks });
		if (compilation || forced) store.set('compilerInputRevision', state.compilerInputRevision + 1);
		store.set('projectChange', { revision: state.projectChange.revision + 1, kind });
		// Project-change subscribers may contribute synchronous layout before placement.
		if (mutation.placeProject === rendering.currentProject) placeCurrentProjectViewport(state, events);
		return true;
	};

	const settle = (work: (mutation: Mutation) => void): Mutation => {
		const mutation: Mutation = { before: new Map(), insertedBlocks: [], collections: new Set() };
		active = true;
		try {
			coordinator.batch(() => {
				work(mutation);
				settlePending(mutation);
			});
			if (mutation.collections.has(rendering.currentProject)) {
				store.set('codeBlockRendering.currentProject.blocks', rendering.currentProject.blocks);
			}
			// Synchronous observers of settled layouts/collections may update contributions.
			while (configPending || environmentPending) coordinator.batch(() => settlePending(mutation));
			return mutation;
		} catch (error) {
			coordinator.clearPending();
			throw error;
		} finally {
			active = false;
			configPending = false;
			environmentPending = false;
		}
	};

	const createBlock = (source: ProjectSourceBlock, project: ProjectLevel): CodeBlockGraphicData => {
		const code = project === rendering.rootProject ? clearEnvironmentOwnership([...source.code]) : [...source.code];
		const name = getCodeBlockNameFromSource(code);
		const block = createCodeBlockGraphicData({
			code,
			name,
			projectPath: project.path,
			creationIndex: rendering.nextCodeBlockCreationIndex++,
			entry: source.entry,
		});
		if (source.childProject) {
			const child: ProjectLevel = {
				path: createChildProjectGroupPath(project.path, name),
				entries: [...source.childProject.entries],
				blocks: [],
			};
			child.blocks = source.childProject.blocks.map(sourceBlock => createBlock(sourceBlock, child));
			block.childProject = child;
		}
		return block;
	};

	const rememberEntry = (project: ProjectLevel, block: CodeBlockGraphicData) => {
		if (supportsExecutionEntry(block) && block.entry !== undefined && !project.entries.includes(block.entry)) {
			project.entries.push(block.entry);
		}
	};

	const apply = (plan: ProjectEditPlan, kind: EditKind = 'edit'): ProjectEditResult => {
		if (active) throw new Error('Cannot start a project edit during source settlement');
		const inserts = plan.inserts ?? [];
		const deletes = new Set(
			(plan.deletes ?? []).filter(block => block !== environment && membership.getOwner(block) !== undefined)
		);
		const removedLevels = new Set<ProjectLevel>();
		for (const block of deletes) {
			if (block.childProject) for (const level of walkProjectLevels(block.childProject)) removedLevels.add(level);
		}
		// Deleting a group already removes its descendants from the attached project.
		for (const block of deletes) {
			if (removedLevels.has(membership.getOwner(block)!)) deletes.delete(block);
		}
		// Check project-tree preconditions before allocating IDs or touching any live
		// source. Source contents (including incomplete declarations) remain editable.
		for (const { codeBlock } of plan.updates ?? []) {
			const owner = membership.getOwner(codeBlock);
			if (!owner || deletes.has(codeBlock) || removedLevels.has(owner)) {
				throw new Error('Cannot update a block that is not part of the resulting project');
			}
		}
		for (const { project } of inserts) {
			if (!membership.hasProject(project) || removedLevels.has(project)) {
				throw new Error('Cannot insert into a level that is not part of the resulting project');
			}
		}
		// Combine repeated updates before comparing actual candidate source, rather than
		// publishing transient changes or invalidating unchanged block identities.
		const candidates = new Map<CodeBlockGraphicData, { code?: string[]; entry?: string }>();
		for (const { codeBlock, code, entry } of plan.updates ?? []) {
			const update = candidates.get(codeBlock) ?? {};
			if (code !== undefined) update.code = [...code];
			if (entry !== undefined) update.entry = entry;
			candidates.set(codeBlock, update);
		}
		for (const [block, update] of candidates) {
			if (update.code !== undefined) {
				if (block === environment) {
					update.code = normalizeEnvironmentSource(update.code, state.envConstantContributions, {
						x: block.gridX,
						y: block.gridY,
					});
				} else if (membership.getOwner(block) === rendering.rootProject) {
					update.code = clearEnvironmentOwnership(update.code);
				}
			}
			if (update.code && sameSource(update.code, block.code)) delete update.code;
			if (block === environment || (update.code === undefined && !supportsExecutionEntry(block))) delete update.entry;
			if (update.entry === block.entry) delete update.entry;
			if (update.code === undefined && update.entry === undefined) candidates.delete(block);
		}
		if (!candidates.size && !inserts.length && !deletes.size) return { changed: false, insertedBlocks: [] };

		const mutation = settle(mutation => {
			if (kind === 'checkpoint') events.dispatch('beforeProjectEdit');
			const nextProject = deletes.size
				? survivingProject(rendering.rootProject, rendering.currentProject, deletes)!
				: rendering.currentProject;
			const viewChanged = nextProject !== rendering.currentProject;
			if (viewChanged) {
				rememberCurrentProjectView(state);
				cancelPendingProjectViewport(state);
			}
			const editedBlocks: CodeBlockGraphicData[] = [];
			for (const [block, update] of candidates) {
				if (block === environment) {
					mutation.environmentIntent = update.code;
					continue;
				}
				if (update.code && setSource(mutation, block, update.code)) editedBlocks.push(block);
			}
			refreshBlockSources(editedBlocks, directives, membership);
			for (const [block, update] of candidates) {
				// Requested entries apply to the final source type, not an intermediate
				// incomplete draft or the type before the source edit.
				if (update.entry !== undefined && supportsExecutionEntry(block)) {
					rememberSource(mutation, block);
					block.entry = update.entry;
				}
				rememberEntry(membership.getOwner(block)!, block);
			}
			for (const block of deletes) {
				const owner = membership.getOwner(block)!;
				mutation.collections.add(owner);
				owner.blocks.splice(owner.blocks.indexOf(block), 1);
				if (owner.selectedBlock === block) owner.selectedBlock = undefined;
			}
			const insertedByProject = new Map<ProjectLevel, CodeBlockGraphicData[]>();
			for (const { project, source } of inserts) {
				const block = createBlock(source, project);
				project.blocks.push(block);
				mutation.insertedBlocks.push(block);
				mutation.collections.add(project);
				const added = insertedByProject.get(project) ?? [];
				added.push(block);
				insertedByProject.set(project, added);
			}
			for (const project of mutation.collections) membership.syncProject(project);
			for (const [project, blocks] of insertedByProject) {
				prepareProjectSources(project, blocks, directives);
				// A hidden project's usable positions are still derived from authored grid coordinates.
				for (const block of blocks.flatMap(block => [
					block,
					...(block.childProject ? [...walkProjectBlocks(block.childProject)] : []),
				])) {
					rememberEntry(membership.getOwner(block)!, block);
					block.x = block.gridX * state.viewport.vGrid;
					block.y = block.gridY * state.viewport.hGrid;
				}
			}
			if (viewChanged || (rendering.selectedCodeBlock && deletes.has(rendering.selectedCodeBlock))) {
				store.set('codeBlockRendering.selectedCodeBlock', undefined);
			}
			if (viewChanged || (rendering.draggedCodeBlock && deletes.has(rendering.draggedCodeBlock))) {
				rendering.draggedCodeBlock = undefined;
			}
			if (viewChanged) {
				store.set('codeBlockRendering.currentProject', nextProject);
				store.set('codeBlockRendering.selectedCodeBlock', nextProject.selectedBlock);
				coordinator.refreshProject(nextProject);
				mutation.placeProject = nextProject;
			}
			configPending = true;
			environmentPending = true;
			coordinator.refreshBlocks(editedBlocks);
			for (const project of mutation.collections) coordinator.refreshProject(project);
		});
		return { changed: publish(mutation, kind), insertedBlocks: mutation.insertedBlocks };
	};

	const restore = (project: ProjectObjectModel, kind: RestoreKind): void => {
		if (active) throw new Error('Cannot restore a project during source settlement');
		const mutation = settle(mutation => {
			const sameProject = kind !== 'replace';
			if (sameProject) rememberCurrentProjectView(state);
			cancelPendingProjectViewport(state);
			const { project: prepared, environmentId } = prepareProjectEnvironmentSource(
				project,
				state.envConstantContributions,
				sameProject ? environment : undefined
			);
			const reconstructed = reconstructProject(
				prepared,
				environmentId,
				directives,
				state.viewport,
				sameProject ? rendering : undefined
			);
			const { rootProject, currentProject, nextCodeBlockCreationIndex } = reconstructed;
			store.set('codeBlockRendering.selectedCodeBlock', undefined);
			rendering.draggedCodeBlock = undefined;
			rendering.nextCodeBlockCreationIndex = nextCodeBlockCreationIndex;
			membership.reset(rootProject);
			environment = rootProject.blocks.find(block => block.creationIndex === environmentId)!;
			coordinator.clearPending();
			store.set('codeBlockRendering.rootProject', rootProject);
			store.set('codeBlockRendering.currentProject', currentProject);
			store.set('codeBlockRendering.selectedCodeBlock', currentProject.selectedBlock);
			configPending = true;
			environmentPending = true;
			mutation.prepareEnvironment = true;
			settlePending(mutation);
			if (kind === 'replace') store.set('editorMode', state.globalEditorDirectives.mode ?? 'view');
			coordinator.refreshProject(currentProject);
			mutation.placeProject = currentProject;
		});
		publish(mutation, kind, true);
	};

	const refreshConfig = () => {
		if (active) {
			configPending = true;
			return;
		}
		publish(
			settle(() => {
				configPending = true;
				coordinator.refreshProject(rendering.currentProject);
			}),
			'edit'
		);
	};

	store.subscribe('editorConfigSchemaContributions', refreshConfig);
	store.subscribe('envConstantContributions', () => {
		if (active) {
			environmentPending = true;
			return;
		}
		publish(
			settle(() => {
				environmentPending = true;
			}),
			'edit'
		);
	});
	// Initialize the already attached tree without publishing a project change.
	// In a fresh editor the tree is empty; installed projects use explicit restore.
	settle(mutation => {
		const root = rendering.rootProject;
		prepareProjectSources(
			root,
			root.blocks.filter(block => block !== environment),
			directives
		);
		configPending = true;
		environmentPending = environment !== undefined;
		mutation.prepareEnvironment = environment !== undefined;
		coordinator.refreshProject(rendering.currentProject);
	});
	return { apply, restore };
}
