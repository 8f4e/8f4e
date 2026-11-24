import type {
	EditorBlockSnapshot,
	EditorCodeBlock,
	EditorLevelSnapshot,
	EditorProjectSnapshot,
	EditorProjectState,
	ProjectLevel,
} from '@8f4e/editor-state-types';
import {
	createChildProjectGroupPath,
	type ProjectBlock,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import compareCodeBlocksByPosition from './blocks/compareCodeBlocksByPosition';
import getCodeBlockNameFromSource from './blocks/getCodeBlockNameFromSource';
import { isEnvironmentSource } from './generatedEnvironment';
import getHighestProjectBlockId from './serialization/getHighestProjectBlockId';

function captureBlock(block: EditorCodeBlock): EditorBlockSnapshot {
	return {
		creationIndex: block.creationIndex,
		code: [...block.code],
		entry: block.entry,
		gridX: block.gridX,
		gridY: block.gridY,
		isProjectScope: block.isProjectScope === true,
		childLevel: block.childLevel ? captureLevel(block.childLevel) : undefined,
	};
}

function captureLevel(level: ProjectLevel, environment?: EditorCodeBlock): EditorLevelSnapshot {
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
	projectState: EditorProjectState,
	environment?: EditorCodeBlock
): EditorProjectSnapshot {
	return {
		rootLevel: captureLevel(projectState.rootLevel, environment),
		nextCodeBlockCreationIndex: projectState.nextCodeBlockCreationIndex,
	};
}

/** Allocation alone is not a source edit, including insert-then-delete within a history debounce. */
export function sameProjectSnapshot(a: EditorProjectSnapshot, b: EditorProjectSnapshot): boolean {
	return JSON.stringify(a.rootLevel) === JSON.stringify(b.rootLevel);
}

/** Translate a loaded compiler project into authored editor source, discarding the root env. */
export function snapshotFromProjectModel(project: ProjectObjectModel): EditorProjectSnapshot {
	const authoredProject = {
		...project,
		constants: project.constants.filter(block => !isEnvironmentSource(block.code)),
	};
	let nextCodeBlockCreationIndex = getHighestProjectBlockId(authoredProject) + 1;
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
			childLevel:
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
	const rootLevel = createLevel(authoredProject, ROOT_PROJECT_GROUP_PATH, true);
	return { rootLevel, nextCodeBlockCreationIndex };
}
