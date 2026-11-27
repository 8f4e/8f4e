import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { ROOT_PROJECT_GROUP_PATH } from '@8f4e/language-spec';
import buildDisplayModel from '../../layout/buildDisplayModel';
import getCodeBlockNameFromSource from './getCodeBlockNameFromSource';

/** Create a block before its source facts and pixel layout have settled. */
export function createEditorCodeBlock(overrides: Partial<EditorCodeBlock> = {}): EditorCodeBlock {
	const x = overrides.x ?? 0;
	const y = overrides.y ?? 0;
	const width = overrides.width ?? 0;
	const height = overrides.height ?? 0;
	const code = overrides.code ?? [];
	const name = (overrides.name ?? getCodeBlockNameFromSource(code)) || 'code-block';
	const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;

	const gridX = overrides.gridX ?? 0;
	const gridY = overrides.gridY ?? 0;

	const cursor = overrides.cursor ?? {
		col: 0,
		row: 0,
		y: 0,
	};

	const defaults: EditorCodeBlock = {
		x,
		y,
		gridX,
		gridY,
		width,
		height,
		cursor,
		name,
		code,
		sourcePreparation: overrides.sourcePreparation ?? {
			lines: [],
			instructionLineBySourceLine: [],
			parsedMemoryLineBySourceLine: [],
		},
		tabStopsByLine: code.map(() => []),
		directiveDisplayState: {},
		displayModel: buildDisplayModel(code),
		gaps: new Map(),
		lineNumberColumnWidth: 1,
		lastUpdated: Date.now(),
		isCollapsed: false,
		creationIndex: 0,
		blockType: overrides.childLevel ? 'group' : 'unknown',
		projectPath,
		disabled: false,
		alwaysOnTop: false,
		parsedDirectives: [],
	};

	return { ...defaults, ...overrides };
}
