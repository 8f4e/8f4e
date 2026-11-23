import type {
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

function captureLevel(level: ProjectLevel): EditorLevelSnapshot {
	return {
		path: level.path,
		entries: [...level.entries],
		blocks: [...level.blocks].sort(compareCodeBlocksByPosition).map(block => ({
			creationIndex: block.creationIndex,
			code: [...block.code],
			entry: block.entry,
			gridX: block.gridX,
			gridY: block.gridY,
			isProjectScope: block.isProjectScope === true,
			childProject: block.childProject ? captureLevel(block.childProject) : undefined,
		})),
	};
}

/** Capture source and retained draft facts independently of view and render state. */
export function captureProjectSnapshot(rendering: CodeBlockRendering, environmentId?: number): EditorProjectSnapshot {
	return {
		rootProject: captureLevel(rendering.rootProject),
		environmentId,
		nextCodeBlockCreationIndex: rendering.nextCodeBlockCreationIndex,
	};
}

/** Allocation alone is not a source edit, including insert-then-delete within a history debounce. */
export function sameProjectSnapshot(a: EditorProjectSnapshot, b: EditorProjectSnapshot): boolean {
	return a.environmentId === b.environmentId && JSON.stringify(a.rootProject) === JSON.stringify(b.rootProject);
}

/** Translate a loaded compiler project into the editor's source tree with no retained draft facts. */
export function snapshotFromProjectModel(project: ProjectObjectModel, environmentId: number): EditorProjectSnapshot {
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
