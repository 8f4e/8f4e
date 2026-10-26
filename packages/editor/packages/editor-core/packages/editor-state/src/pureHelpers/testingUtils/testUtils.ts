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
			lines: code.map((text, rawRow) => ({ text, rawRow })),
			displayRowToRawRow: code.map((_, rawRow) => rawRow),
			rawRowToDisplayRow: code.map((_, rawRow) => rawRow),
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
			switches: [],
			buttons: [],
			sliders: [],
			crossfades: [],
			pianoKeyboards: [],
			arrayPlotters: [],
			arrayBars: [],
			arrayMeters: [],
			arrayWaves: [],
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
 * const button = findWidgetById(mockGraphicData.widgets.buttons, 'btn1');
 * expect(button).toBeDefined();
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

/**
 * Helper to create a mock State object for testing with customizable properties
 * @param overrides Optional deep partial State to override defaults (nested properties can be partially specified)
 * @returns A complete State object with sensible defaults
 *
 * @example
 * const state = createMockState();
 * const state = createMockState({ info: { compiler: { compilationTimeMs: 123 } } });
 * const state = createMockState({ callbacks: { setWordInMemory: () => {} } });
 */
export function createMockState(overrides: DeepPartial<State> = {}): State {
	const mockRuntimeFactory = () => () => {};
	const workerRuntimeDefaults = { sampleRate: 50 } as const;
	const rootCodeBlocks: CodeBlockGraphicData[] = [];

	const defaults: State = {
		compilerInputRevision: 0,
		projectRevision: 0,
		compiler: {
			isCompiling: false,
			compiledModules: {},
			memoryPlan: {
				modules: {},
				moduleList: [],
			},
			memoryDefaultsByModuleId: {},
			projectMemoryExposuresByGroupPath: {},
		},
		callbacks: {
			loadSession: createMockAsyncFunction(null),
		},
		runtimeRegistry: {
			WebWorkerRuntime: {
				id: 'WebWorkerRuntime',
				editorConfigSchema: {
					root: 'workerRuntime',
					defaults: workerRuntimeDefaults,
					schema: { type: 'object', properties: {} },
				},
				factory: mockRuntimeFactory,
			},
		},
		codeBlockRendering: {
			rootCodeBlocks,
			codeBlocks: rootCodeBlocks,
			entryOutlines: [],
			viewportAnchoredCodeBlocks: [],
			nextCodeBlockCreationIndex: 0,
			outputsByWordAddress: new Map(),
		},
		contextMenu: {
			highlightedItem: 0,
			itemWidth: 200,
			items: [],
			open: false,
			x: 0,
			y: 0,
			menuStack: [],
		},
		info: {
			compiler: {
				isCompiling: false,
				compilationTimeMs: 0,
				wasmByteCodeBytes: 0,
				requiredMemoryBytes: 0,
				allocatedMemoryBytes: 0,
				allocatedPages: 0,
				memoryUsagePercent: 0,
				astCacheHits: 0,
				astCacheMisses: 0,
				memoryReinitialized: false,
			},
		},
		tooltip: {
			text: [],
			characters: [],
			colors: [],
			lineCount: 0,
			widthChars: 0,
			layout: {
				horizontalPadding: 0,
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				lineX: 0,
			},
			highlights: [],
			liveValues: [],
			target: undefined,
			animation: {
				startedAt: undefined,
			},
		},
		featureFlags: {
			contextMenu: true,
			moduleDragging: true,
			codeLineSelection: true,
			viewportDragging: true,
			editing: true,
			modeToggling: true,
			modeOverlay: true,
			offscreenBlockArrows: true,
			projectOpening: true,
			projectCreation: true,
		},
		editorMode: 'edit',
		editorConfig: {},
		editorConfigValidators: {},
		editorConfigSchemaContributions: {},
		historyStack: [],
		redoStack: [],
		storageQuota: { usedBytes: 0, totalBytes: 0 },
		binaryAssets: [],
		codeErrors: {
			compilationErrors: [],
			editorDirectiveErrors: [],
		},
		console: {
			logs: [],
			maxLogs: 100,
		},
		assertionResults: [],
		runtime: {
			values: {},
		},
		globalEditorDirectives: {},
		dialog: {
			id: '',
			text: '',
			wrappedText: [''],
			title: '',
			buttons: [],
			highlightedButton: Infinity,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
		},
		dialogStack: [],
		viewport: {
			x: 0,
			y: 0,

			width: 1024,
			height: 768,
			roundedWidth: 1024,
			roundedHeight: 768,
			vGrid: 8,
			hGrid: 16,
			borderLineCoordinates: {
				top: { startX: 0, startY: 0, endX: 0, endY: 0 },
				right: { startX: 0, startY: 0, endX: 0, endY: 0 },
				bottom: { startX: 0, startY: 0, endX: 0, endY: 0 },
				left: { startX: 0, startY: 0, endX: 0, endY: 0 },
			},
			center: { x: 0, y: 0 },
		},
		viewportAnimation: {
			startX: 0,
			startY: 0,
			targetX: 0,
			targetY: 0,
			active: false,
		},
	};

	return mergeDeep(defaults, overrides);
}

/**
 * Deep merge helper for combining default state with overrides
 * @param target The target object
 * @param source The source object with overrides (can be deeply partial)
 * @returns The merged object
 */
function mergeDeep<T>(target: T, source: DeepPartial<T>): T {
	if (typeof target !== 'object' || target === null || Array.isArray(target)) {
		return target;
	}

	const result = { ...target } as T;
	const sourceObj = source as Record<string, unknown>;

	for (const key in sourceObj) {
		if (!Object.hasOwn(sourceObj, key)) {
			continue;
		}

		const sourceValue = sourceObj[key];
		const targetKey = key as keyof T;
		const targetValue = result[targetKey];

		if (sourceValue === undefined) {
			continue;
		}

		const shouldMerge =
			sourceValue !== null &&
			typeof sourceValue === 'object' &&
			!Array.isArray(sourceValue) &&
			targetValue !== null &&
			targetValue !== undefined &&
			typeof targetValue === 'object' &&
			!Array.isArray(targetValue) &&
			!(targetValue instanceof WebAssembly.Memory) &&
			!(targetValue instanceof Int32Array) &&
			!(targetValue instanceof Float32Array) &&
			!(targetValue instanceof Uint8Array) &&
			!(targetValue instanceof Map) &&
			!(targetValue instanceof Set);

		if (shouldMerge) {
			result[targetKey] = mergeDeep(targetValue, sourceValue as DeepPartial<typeof targetValue>);
		} else {
			result[targetKey] = sourceValue as T[keyof T];
		}
	}

	return result;
}
export { createMockState } from '@8f4e/editor-state-testing';
