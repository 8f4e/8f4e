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
import { isEnvironmentSource } from '../code-blocks/features/auto-env-constants/source';
import getCodeBlockNameFromSource from '../code-blocks/utils/getCodeBlockNameFromSource';

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

/** Allocation alone is not a source edit, including insert-then-delete within a history debounce. */
export function sameProjectSnapshot(a: EditorProjectSnapshot, b: EditorProjectSnapshot): boolean {
	return JSON.stringify(a.rootProject) === JSON.stringify(b.rootProject);
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
	const rootProject = createLevel(authoredProject, ROOT_PROJECT_GROUP_PATH, true);
	return { rootProject, nextCodeBlockCreationIndex };
}
