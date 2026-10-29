import type { CodeBlockGraphicData, EventDispatcher, State, Viewport } from '@8f4e/editor-state-types';
import { ROOT_PROJECT_GROUP_PATH } from '@8f4e/language-spec';

type DeepPartial<T> = T extends (...args: never[]) => unknown
	? T
	: T extends object
		? {
				[P in keyof T]?: DeepPartial<T[P]>;
			}
		: T;

// EditorConfig already accepts partial JSON; expanding its recursive values adds no useful constraints.
type StateOverrides = {
	[K in keyof State]?: K extends 'editorConfig' ? State[K] : DeepPartial<State[K]>;
};

function createMockFunction<T extends (...args: unknown[]) => unknown>(): T {
	return (() => {}) as T;
}

export function createMockCodeBlock(
	options: Partial<CodeBlockGraphicData> & { cursorY?: number } = {}
): CodeBlockGraphicData {
	const { cursorY, ...overrides } = options;

	const x = overrides.x ?? 0;
	const y = overrides.y ?? 0;
	const width = overrides.width ?? 100;
	const height = overrides.height ?? 100;
	const code = overrides.code ?? [];
	const name = overrides.name ?? code[0]?.trim().split(/\s+/)[1] ?? 'test-block';
	const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;
	const defaultVGrid = 8;
	const defaultHGrid = 16;
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
	const displayModel = {
		lines: code.map((text, sourceLineIndex) => ({ text, sourceLineIndex })),
		displayRowToSourceLineIndex: code.map((_, sourceLineIndex) => sourceLineIndex),
		sourceLineIndexToDisplayRow: code.map((_, sourceLineIndex) => sourceLineIndex),
		isCollapsed: false,
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
		displayModel,
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
		parsedDirectives: [],
		widgets: {
			blockHighlights: [],
			inputs: [],
			outputs: [],
			infoPanels: [],
			shapeDeclarations: [],
			errorMessages: [],
		},
	};

	return { ...defaults, ...overrides };
}

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

export function createMockEventDispatcher(): EventDispatcher {
	return {
		on: createMockFunction(),
		off: createMockFunction(),
		dispatch: createMockFunction(),
	};
}

export function createMockState(overrides: StateOverrides = {}): State {
	const workerRuntimeDefaults = { sampleRate: 50 } as const;
	const rootCodeBlocks: CodeBlockGraphicData[] = [];

	const defaults: State = {
		compilerInputRevision: 0,
		projectChange: { revision: 0, kind: 'replace' },
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
		callbacks: {},
		runtimeRegistry: {
			WebWorkerRuntime: {
				id: 'WebWorkerRuntime',
				editorConfigSchema: {
					root: 'workerRuntime',
					defaults: workerRuntimeDefaults,
					schema: { type: 'object', properties: {} },
				},
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
		featureFlags: {
			contextMenu: true,
			moduleDragging: true,
			codeLineSelection: true,
			viewportDragging: true,
			editing: true,
			modeToggling: true,
			modeOverlay: true,
			offscreenBlockArrows: true,
			projectCreation: true,
		},
		editorMode: 'edit',
		editorConfig: {},
		editorConfigValidators: {},
		editorConfigSchemaContributions: {},
		historyStack: [],
		redoStack: [],
		envConstantContributions: {},
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

	const state = mergeDeep<State>(defaults, overrides);
	const rendering = overrides.codeBlockRendering;
	if (rendering?.rootCodeBlocks !== undefined && rendering.codeBlocks === undefined) {
		state.codeBlockRendering.codeBlocks = state.codeBlockRendering.rootCodeBlocks;
	} else if (rendering?.codeBlocks !== undefined && rendering.rootCodeBlocks === undefined) {
		state.codeBlockRendering.rootCodeBlocks = state.codeBlockRendering.codeBlocks;
	}
	return state;
}

function mergeDeep<T>(target: T, source: unknown): T {
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
			result[targetKey] = mergeDeep(targetValue, sourceValue);
		} else {
			result[targetKey] = sourceValue as T[keyof T];
		}
	}

	return result;
}
