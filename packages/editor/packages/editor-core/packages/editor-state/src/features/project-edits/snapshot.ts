import type {
	CodeBlockGraphicData,
	CodeBlockRendering,
	EditorBlockSnapshot,
	EditorLevelSnapshot,
	EditorProjectSnapshot,
	ProjectLevel,
} from '@8f4e/editor-state-types';
import {
	createChildProjectGroupPath,
	type ProjectBlock,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import compareCodeBlocksByPosition from '../../pureHelpers/compareCodeBlocksByPosition';
import getHighestProjectBlockId from '../../pureHelpers/projectSerialization/getHighestProjectBlockId';
import getCodeBlockNameFromSource from '../code-blocks/utils/getCodeBlockNameFromSource';

/** An installation has the managed block attached; history retains authored source alone. */
export interface ProjectInstallation extends EditorProjectSnapshot {
	readonly environmentId?: number;
}

function captureBlock(block: CodeBlockGraphicData): EditorBlockSnapshot {
	return {
		creationIndex: block.creationIndex,
		code: [...block.code],
		entry: block.entry,
		gridX: block.gridX,
		gridY: block.gridY,
		isProjectScope: block.isProjectScope === true,
		childProject: block.childProject ? captureLevel(block.childProject) : undefined,
	};
}

function captureLevel(level: ProjectLevel, environment?: CodeBlockGraphicData): EditorLevelSnapshot {
	return {
		path: level.path,
		entries: [...level.entries],
		blocks: level.blocks
			.filter(block => block !== environment)
			.sort(compareCodeBlocksByPosition)
			.map(captureBlock),
	};
}

/** Capture authored source and retained draft facts independently of generated source and view state. */
export function captureProjectSnapshot(
	rendering: CodeBlockRendering,
	environment?: CodeBlockGraphicData
): EditorProjectSnapshot {
	return {
		rootProject: captureLevel(rendering.rootProject, environment),
		nextCodeBlockCreationIndex: rendering.nextCodeBlockCreationIndex,
	};
}

/** History restores the current managed root environment, including its position, rather than a historical generated block. */
export function snapshotForRestoration(
	snapshot: EditorProjectSnapshot,
	environment?: CodeBlockGraphicData
): ProjectInstallation {
	if (!environment) return snapshot;
	return {
		...snapshot,
		environmentId: environment.creationIndex,
		rootProject: {
			...snapshot.rootProject,
			blocks: [...snapshot.rootProject.blocks, captureBlock(environment)].sort(compareCodeBlocksByPosition),
		},
	};
}

/** Allocation alone is not a source edit, including insert-then-delete within a history debounce. */
export function sameProjectSnapshot(a: EditorProjectSnapshot, b: EditorProjectSnapshot): boolean {
	return JSON.stringify(a.rootProject) === JSON.stringify(b.rootProject);
}

/** Translate a loaded compiler project into the editor's source tree with no retained draft facts. */
export function snapshotFromProjectModel(project: ProjectObjectModel, environmentId: number): ProjectInstallation {
	let nextCodeBlockCreationIndex = getHighestProjectBlockId(project) + 1;
	const createBlock = (block: ProjectBlock): EditorBlockSnapshot => ({
		creationIndex: block.id,
		code: [...block.code],
		gridX: 0,
		gridY: 0,
		isProjectScope: false,
	});
	const createLevel = (level: ProjectObjectModel, path: ProjectGroupPath, root = false): EditorLevelSnapshot => {
		const scoped: EditorBlockSnapshot[] =
			root && level.code.length
				? [{ ...createBlock({ id: nextCodeBlockCreationIndex++, code: level.code }), isProjectScope: true }]
				: [];
		const execution: EditorBlockSnapshot[] = level.execution.map(block => ({
			...createBlock(block),
			entry: block.entry,
			childProject:
				block.type === 'group'
					? createLevel(block, createChildProjectGroupPath(path, getCodeBlockNameFromSource(block.code)))
					: undefined,
		}));
		return {
			path,
			entries: [...level.entries],
			blocks: [
				...scoped,
				...level.functions.map(createBlock),
				...level.constants.map(createBlock),
				...level.includes.map(createBlock),
				...level.notes.map(createBlock),
				...level.unknown.map(createBlock),
				...execution,
			],
		};
	};
	const rootProject = createLevel(project, ROOT_PROJECT_GROUP_PATH, true);
	return { rootProject, environmentId, nextCodeBlockCreationIndex };
}
