import type {
	CodeBlockGraphicData,
	DirectiveDerivedState,
	DirectiveDeriveOptions,
	EventDispatcher,
	Viewport,
} from '@8f4e/editor-state-types';
import { ROOT_PROJECT_GROUP_PATH } from '@8f4e/language-spec';
import { deriveDirectiveState } from '~/features/code-blocks/features/directives/registry';
import getCodeBlockNameFromSource from '~/features/code-blocks/utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '~/features/code-blocks/utils/parseBlockDirectives';

/**
 * Creates a no-op function that can be used as a mock in any testing framework
 */
function createMockFunction<T extends (...args: unknown[]) => unknown>(): T {
	return (() => {}) as T;
}

/**
 * Helper to create a mock code block for testing with customizable properties.
 * All parameters are specified via an options object.
 *
 * @param options - Optional configuration object with any CodeBlockGraphicData properties plus cursorY convenience parameter
 * @param options.cursorY - Optional convenience parameter to set cursor.y (relative to block)
 * @returns A complete CodeBlockGraphicData object with sensible defaults
 *
 * @remarks
 * **Cursor Coordinate System:**
 * - `cursor.x` is absolute (computed as block center: x + width/2)
 * - `cursor.y` is relative to the block (defaults to height/2, i.e., center of block)
 *
 * @example
 * // Basic usage with defaults
 * const block = createMockCodeBlock();
 *
 * @example
 * // Specify position and dimensions
 * const block = createMockCodeBlock({ x: 100, y: 200, width: 150, height: 150 });
 *
 * @example
 * // Use cursorY convenience parameter
 * const block = createMockCodeBlock({ name: 'my-block', x: 100, y: 200, cursorY: 75 });
 *
 * @example
 * // Override any property
 * const block = createMockCodeBlock({ name: 'custom', code: ['test'] });
 */
export function createMockCodeBlock(
	options: Partial<CodeBlockGraphicData> & { cursorY?: number } = {}
): CodeBlockGraphicData {
	const { cursorY, ...overrides } = options;

	const x = overrides.x ?? 0;
	const y = overrides.y ?? 0;
	const width = overrides.width ?? 100;
	const height = overrides.height ?? 100;
	const code = overrides.code ?? [];
	const name = (overrides.name ?? getCodeBlockNameFromSource(code)) || 'test-block';
	const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;

	// Default grid size for testing (matches common font sizes)
	const defaultVGrid = 8;
	const defaultHGrid = 16;

	// If gridX/gridY are provided, use them. Otherwise compute from x/y
	const gridX = overrides.gridX ?? Math.round(x / defaultVGrid);
	const gridY = overrides.gridY ?? Math.round(y / defaultHGrid);

	const cursorX = x + width / 2;
	const cursorYValue = cursorY ?? height / 2;
	const cursor = overrides.cursor ?? {
		col: 0,
		row: 0,
		x: cursorX,
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
		displayModel: {
			lines: code.map((text, sourceLineIndex) => ({ text, sourceLineIndex })),
			displayRowToSourceLineIndex: code.map((_, sourceLineIndex) => sourceLineIndex),
			sourceLineIndexToDisplayRow: code.map((_, sourceLineIndex) => sourceLineIndex),
			isCollapsed: false,
		},
		gaps: new Map(),
		lineNumberColumnWidth: 1,
		lastUpdated: Date.now(),
		isCollapsed: false,
		creationIndex: 0,
		blockType: 'unknown',
		projectPath,
		disabled: false,
		isHome: false,
		isFavorite: false,
		alwaysOnTop: false,
		parsedDirectives: parseBlockDirectives(code),
		widgets: {
			assertions: [],
			blockHighlights: [],
			inputs: [],
			outputs: [],
			debuggers: [],
			crossfades: [],
			arrayPlotters: [],
			arrayBars: [],
			arrayMeters: [],
			infoPanels: [],
			shapeDeclarations: [],
			errorMessages: [],
		},
	};

	return { ...defaults, ...overrides };
}

export function setMockCodeBlockCode(codeBlock: CodeBlockGraphicData, code: string[]): void {
	codeBlock.code = code;
	codeBlock.parsedDirectives = parseBlockDirectives(code);
}

export function deriveDirectiveStateForMockCodeBlock(
	codeBlock: CodeBlockGraphicData,
	options?: DirectiveDeriveOptions
): DirectiveDerivedState {
	codeBlock.parsedDirectives = parseBlockDirectives(codeBlock.code);
	return deriveDirectiveState(codeBlock.code, codeBlock.parsedDirectives, options);
}

export function deriveDirectiveStateForCode(
	code: string[],
	options?: DirectiveDeriveOptions,
	overrides: Partial<CodeBlockGraphicData> = {}
): DirectiveDerivedState {
	return deriveDirectiveStateForMockCodeBlock(createMockCodeBlock({ code, ...overrides }), options);
}

/**
 * Helper to find an item by id in a widgets array
 * Useful for test assertions on array-based widgets
 *
 * @param array - The widgets array to search
 * @param id - The id to find
 * @returns The item with the matching id, or undefined if not found
 *
 * @example
 * const output = findWidgetById(mockGraphicData.widgets.outputs, 'output1');
 * expect(output).toBeDefined();
 */
export function findWidgetById<T extends { id: string }>(array: T[], id: string): T | undefined {
	return array.find(item => item.id === id);
}

/**
 * Helper to create a mock viewport for testing (code block rendering viewport type)
 * @param x - X coordinate (defaults to 0)
 * @param y - Y coordinate (defaults to 0)
 * @param width - Viewport width (defaults to 800)
 * @param height - Viewport height (defaults to 600)
 * @returns A code block rendering viewport object
 *
 * @example
 * const viewport = createMockViewport();
 * const viewport = createMockViewport(100, 200);
 * const viewport = createMockViewport(100, 200, 1920, 1080);
 * const viewport = createMockViewport(100, 200, 800, 600);
 */
export function createMockViewport(x = 0, y = 0, width = 800, height = 600): Viewport {
	return {
		x,
		y,
		width,
		height,
		roundedWidth: width,
		roundedHeight: height,
		vGrid: 8,
		hGrid: 16,
		borderLineCoordinates: {
			top: { startX: 0, startY: 0, endX: 0, endY: 0 },
			right: { startX: 0, startY: 0, endX: 0, endY: 0 },
			bottom: { startX: 0, startY: 0, endX: 0, endY: 0 },
			left: { startX: 0, startY: 0, endX: 0, endY: 0 },
		},
		center: { x: 0, y: 0 },
	};
}

/**
 * Helper to create a mock EventDispatcher for testing
 * @returns A mocked EventDispatcher with no-op functions
 *
 * @example
 * const events = createMockEventDispatcher();
 * // Can be used with any testing framework (Vitest, Jest, Playwright, etc.)
 */
export function createMockEventDispatcher(): EventDispatcher {
	return {
		on: createMockFunction(),
		off: createMockFunction(),
		dispatch: createMockFunction(),
	};
}

export { createMockState } from '@8f4e/editor-state-testing';
