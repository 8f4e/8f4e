import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { ROOT_PROJECT_GROUP_PATH } from '@8f4e/language-spec';
import buildDisplayModel from '../buildDisplayModel';
import getCodeBlockNameFromSource from './getCodeBlockNameFromSource';

export function createCodeBlockGraphicData(
	options: Partial<CodeBlockGraphicData> & { cursorY?: number } = {}
): CodeBlockGraphicData {
	const { cursorY, ...overrides } = options;

	const x = overrides.x ?? 0;
	const y = overrides.y ?? 0;
	const width = overrides.width ?? 100;
	const height = overrides.height ?? 100;
	const code = overrides.code ?? [];
	const name = (overrides.name ?? getCodeBlockNameFromSource(code)) || 'code-block';
	const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;

	const gridX = overrides.gridX ?? 0;
	const gridY = overrides.gridY ?? 0;

	const cursorYValue = cursorY ?? height / 2;
	const cursor = overrides.cursor ?? {
		col: 0,
		row: 0,
		y: cursorYValue,
	};

	const defaults: CodeBlockGraphicData = {
		x,
		y,
		gridX,
		gridY,
		width,
		height,
		cursor,
		name,
		code,
		tabStopsByLine: code.map(() => []),
		directiveDisplayState: {},
		displayModel: buildDisplayModel(code),
		gaps: new Map(),
		lineNumberColumnWidth: 1,
		lastUpdated: Date.now(),
		isCollapsed: false,
		creationIndex: 0,
		blockType: 'unknown',
		projectPath,
		disabled: false,
		alwaysOnTop: false,
		parsedDirectives: [],
	};

	return { ...defaults, ...overrides };
}
