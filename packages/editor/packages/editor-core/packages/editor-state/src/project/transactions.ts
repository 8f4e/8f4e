import type {
	CodeBlockGraphicData,
	EditorDirectiveDefinition,
	EditorProjectSnapshot,
	EventDispatcher,
	ProjectChangeDetails,
	ProjectEditOptions,
	ProjectEditPlan,
	ProjectEditResult,
	ProjectEdits,
	ProjectLevel,
	ProjectSourceBlock,
	State,
} from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { isOrdinaryCommentLine } from '../directives/directiveRecords';
import resolveEditorConfig from '../directives/global/resolveProjectDirectives';
import type { LayoutCoordinator } from '../layout/blockLayoutCoordinator';
import {
	cancelPendingProjectViewport,
	placeCurrentProjectViewport,
	rememberCurrentProjectView,
} from '../viewport/updateViewport';
import { createCodeBlockGraphicData } from './blocks/createEditorCodeBlock';
import getCodeBlockNameFromSource from './blocks/getCodeBlockNameFromSource';
import {
	prepareProjectSources,
	refreshBlockSources,
	rememberEntry,
	supportsExecutionEntry,
} from './blocks/refreshSourceMetadata';
import { generateEnvironmentSource, isEnvironmentSource } from './generatedEnvironment';
import type { ProjectMembership } from './membership';
import { reconstructProject } from './reconstruction';
import { captureProjectSnapshot, snapshotFromProjectModel } from './snapshots';
import { walkProjectBlocks, walkProjectLevels } from './tree';

type RestoreKind = 'replace' | 'restore';
const generatedChange = { kind: 'generated' } as const satisfies ProjectChangeDetails;

/** A structural plan conflict detected before beginning a mutation. */
export class ProjectEditPlanError extends Error {
	constructor(
		public readonly code: 'detached_block' | 'detached_project' | 'deleted_block' | 'deleted_project',
		message: string
	) {
		super(message);
		this.name = 'ProjectEditPlanError';
	}
}

/** Internal mutation service; the plugin-facing contract exposes only live edits. */
export interface ProjectEditService extends ProjectEdits {
	load(project: ProjectObjectModel): void;
	capture(): EditorProjectSnapshot;
	restore(snapshot: EditorProjectSnapshot): void;
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
	coordinator: LayoutCoordinator
): ProjectEditService {
	const state = store.getState();
	const rendering = state.codeBlockRendering;
	let environment: CodeBlockGraphicData | undefined;
	let active = false;
	let configPending = false;
	let environmentPending = false;

	const collectChanges = (mutation: Mutation) => {
		let compilation = mutation.collections.size > 0;
		let changed = compilation;
		for (const [block, before] of mutation.before) {
			if (!sameSource(before.code, block.code)) {
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
		return { changed, compilation };
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
		if (setSource(mutation, environment, generateEnvironmentSource(state.envConstantContributions))) {
			refreshBlockSources([environment], directives, membership);
			coordinator.refreshBlocks([environment]);
		}
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

	const publish = (mutation: Mutation, change: ProjectChangeDetails): boolean => {
		const { changed, compilation } = collectChanges(mutation);
		const force = change.kind === 'restore' || change.kind === 'replace';
		if (!changed && !force) return false;
		if (compilation || force) store.set('compilerInputRevision', state.compilerInputRevision + 1);
		store.set('projectChange', { revision: state.projectChange.revision + 1, ...change });
		// Project-change subscribers may contribute synchronous layout before placement.
		if (mutation.placeProject === rendering.currentProject) placeCurrentProjectViewport(state, events);
		return true;
	};

	const settle = (work: (mutation: Mutation) => void): Mutation => {
		const mutation: Mutation = { before: new Map(), insertedBlocks: [], collections: new Set() };
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
	};

	const finishMutation = (work: (mutation: Mutation) => void, change: ProjectChangeDetails) => {
		if (active) throw new Error('Cannot start a project edit during another project edit');
		active = true;
		try {
			const mutation = settle(work);
			const changed = publish(mutation, change);
			// Contributions from completion observers belong to a follow-up operation,
			// never a nested publication that can interrupt history or persistence.
			while (configPending || environmentPending) {
				const followUp = settle(() => {
					if (configPending) coordinator.refreshProject(rendering.currentProject);
				});
				publish(followUp, generatedChange);
			}
			return { changed, insertedBlocks: mutation.insertedBlocks };
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
		const code = [...source.code];
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

	const apply = (plan: ProjectEditPlan, { history = 'debounced' }: ProjectEditOptions = {}): ProjectEditResult => {
		if (active) throw new Error('Cannot start a project edit during another project edit');
		const requestedInserts = plan.inserts ?? [];
		const updates = (plan.updates ?? []).filter(({ codeBlock }) => !codeBlock.readOnly);
		const deletes = new Set(
			(plan.deletes ?? []).filter(block => !block.readOnly && membership.getOwner(block) !== undefined)
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
		for (const { codeBlock } of updates) {
			const owner = membership.getOwner(codeBlock);
			if (!owner) throw new ProjectEditPlanError('detached_block', 'Cannot update a detached block');
			if (deletes.has(codeBlock) || removedLevels.has(owner)) {
				throw new ProjectEditPlanError('deleted_block', 'Cannot update a block being deleted');
			}
		}
		for (const { project } of requestedInserts) {
			if (!membership.hasProject(project)) {
				throw new ProjectEditPlanError('detached_project', 'Cannot insert into a detached project level');
			}
			if (removedLevels.has(project)) {
				throw new ProjectEditPlanError('deleted_project', 'Cannot insert into a project group being deleted');
			}
		}
		// The generated block exclusively owns the root constants env namespace.
		// Authored attempts to create one are no-ops, like edits to the read-only owner.
		const inserts = requestedInserts.filter(
			({ project, source }) => project !== rendering.rootProject || !isEnvironmentSource([...source.code])
		);
		// Combine repeated updates before comparing actual candidate source, rather than
		// publishing transient changes or invalidating unchanged block identities.
		const candidates = new Map<CodeBlockGraphicData, { code?: string[]; entry?: string }>();
		for (const { codeBlock, code, entry } of updates) {
			const update = candidates.get(codeBlock) ?? {};
			if (code !== undefined) update.code = [...code];
			if (entry !== undefined) update.entry = entry;
			candidates.set(codeBlock, update);
		}
		for (const [block, update] of candidates) {
			if (update.code && membership.getOwner(block) === rendering.rootProject && isEnvironmentSource(update.code)) {
				candidates.delete(block);
				continue;
			}
			if (update.code && sameSource(update.code, block.code)) delete update.code;
			if (update.code === undefined && !supportsExecutionEntry(block)) delete update.entry;
			if (update.entry === block.entry) delete update.entry;
			if (update.code === undefined && update.entry === undefined) candidates.delete(block);
		}
		if (!candidates.size && !inserts.length && !deletes.size) return { changed: false, insertedBlocks: [] };

		return finishMutation(
			mutation => {
				if (history === 'checkpoint') events.dispatch('beforeProjectEdit');
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
				if (mutation.collections.size > 0) membership.reset(rendering.rootProject);
				for (const [project, blocks] of insertedByProject) {
					prepareProjectSources(project, blocks, directives);
					// A hidden project's usable positions are still derived from authored grid coordinates.
					for (const block of blocks.flatMap(block => [
						block,
						...(block.childProject ? [...walkProjectBlocks(block.childProject)] : []),
					])) {
						block.x = block.gridX * state.viewport.vGrid;
						block.y = block.gridY * state.viewport.hGrid;
					}
				}
				if (viewChanged || (rendering.selectedCodeBlock && deletes.has(rendering.selectedCodeBlock))) {
					store.set('codeBlockRendering.selectedCodeBlock', undefined);
				}
				if (viewChanged) {
					store.set('codeBlockRendering.currentProject', nextProject);
					store.set('codeBlockRendering.selectedCodeBlock', nextProject.selectedBlock);
					coordinator.refreshProject(nextProject);
					mutation.placeProject = nextProject;
				}
				configPending = true;
				coordinator.refreshBlocks(editedBlocks);
				for (const project of mutation.collections) coordinator.refreshProject(project);
			},
			{ kind: 'edit', history }
		);
	};

	const install = (kind: RestoreKind, snapshot: EditorProjectSnapshot): void => {
		finishMutation(
			mutation => {
				const sameProject = kind !== 'replace';
				if (sameProject) rememberCurrentProjectView(state);
				cancelPendingProjectViewport(state);
				const reconstructed = reconstructProject(
					snapshot,
					directives,
					state.viewport,
					sameProject ? rendering : undefined
				);
				const { rootProject, currentProject, nextCodeBlockCreationIndex } = reconstructed;
				const wasEnvironmentSelected =
					sameProject && environment && rendering.rootProject.selectedBlock === environment;
				store.set('codeBlockRendering.selectedCodeBlock', undefined);
				rendering.nextCodeBlockCreationIndex = nextCodeBlockCreationIndex;
				if (!sameProject) {
					environment = createCodeBlockGraphicData({
						name: 'env',
						readOnly: true,
						creationIndex: rendering.nextCodeBlockCreationIndex++,
					});
				}
				if (environment) {
					// Generated source is not part of an authored snapshot; reuse its live
					// identity across history, and keep it behind overlapping authored blocks.
					rootProject.blocks.unshift(environment);
					if (wasEnvironmentSelected) rootProject.selectedBlock = environment;
				}
				membership.reset(rootProject);
				coordinator.clearPending();
				store.set('codeBlockRendering.rootProject', rootProject);
				store.set('codeBlockRendering.currentProject', currentProject);
				store.set('codeBlockRendering.selectedCodeBlock', currentProject.selectedBlock);
				configPending = true;
				environmentPending = environment !== undefined;
				settlePending(mutation);
				if (kind === 'replace') store.set('editorMode', state.globalEditorDirectives.mode ?? 'view');
				coordinator.refreshProject(currentProject);
				mutation.placeProject = currentProject;
			},
			{ kind }
		);
	};
	const load = (project: ProjectObjectModel): void => install('replace', snapshotFromProjectModel(project));
	const capture = () => captureProjectSnapshot(rendering, environment);
	const restore = (snapshot: EditorProjectSnapshot): void => install('restore', snapshot);

	const refreshConfig = () => {
		if (active) {
			configPending = true;
			return;
		}
		finishMutation(() => {
			configPending = true;
			coordinator.refreshProject(rendering.currentProject);
		}, generatedChange);
	};

	store.subscribe('editorConfigSchemaContributions', refreshConfig);
	store.subscribe('envConstantContributions', () => {
		if (active) {
			environmentPending = true;
			return;
		}
		finishMutation(() => {
			environmentPending = true;
		}, generatedChange);
	});
	return { apply, load, capture, restore };
}
