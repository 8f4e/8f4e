import type {
	EditorCodeBlock,
	EventDispatcher,
	GridSize,
	ProjectLevel,
	State,
	Viewport,
} from '@8f4e/editor-state-types';
import {
	ArgumentType,
	isArrayMemoryDeclarationInstructionName,
	type MemoryDeclarationInstruction,
	type MemoryDeclarationLine,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';

/** Representative character-cell dimensions for tests that need settled pixel geometry. */
export const TEST_GRID_SIZE = { vGrid: 8, hGrid: 16 } as const satisfies GridSize;

type DeepPartial<T> = T extends (...args: never[]) => unknown
	? T
	: T extends object
		? {
				[P in keyof T]?: DeepPartial<T[P]>;
			}
		: T;

type ProjectOverrides = Omit<Partial<State['project']>, 'rootLevel' | 'activeLevel'> &
	(
		| { rootLevel?: Partial<ProjectLevel>; activeLevel?: never }
		| { rootLevel?: never; activeLevel: Partial<ProjectLevel> }
		| { rootLevel: ProjectLevel; activeLevel: ProjectLevel }
	);

// EditorConfig already accepts partial JSON; expanding its recursive values adds no useful constraints.
type StateOverrides = {
	[K in Exclude<keyof State, 'project'>]?: K extends 'editorConfig' ? State[K] : DeepPartial<State[K]>;
} & { project?: ProjectOverrides };

function createMockFunction<T extends (...args: unknown[]) => unknown>(): T {
	return (() => {}) as T;
}

export function createMockCodeBlock(options: Partial<EditorCodeBlock> & { cursorY?: number } = {}): EditorCodeBlock {
	const { cursorY, ...overrides } = options;

	const x = overrides.x ?? 0;
	const y = overrides.y ?? 0;
	const width = overrides.width ?? 100;
	const height = overrides.height ?? 100;
	const code = overrides.code ?? [];
	const name = overrides.name ?? code[0]?.trim().split(/\s+/)[1] ?? 'test-block';
	const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;
	const gridX = overrides.gridX ?? Math.round(x / TEST_GRID_SIZE.vGrid);
	const gridY = overrides.gridY ?? Math.round(y / TEST_GRID_SIZE.hGrid);
	const cursorYValue = cursorY ?? height / 2;
	const cursor = overrides.cursor ?? {
		col: 0,
		row: 0,
		y: cursorYValue,
	};
	const displayModel = {
		lines: code.map((text, sourceLineIndex) => ({ text, sourceLineIndex })),
		displayRowToSourceLineIndex: code.map((_, sourceLineIndex) => sourceLineIndex),
		sourceLineIndexToDisplayRow: code.map((_, sourceLineIndex) => sourceLineIndex),
		isCollapsed: false,
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
		tabStopsByLine: code.map(() => []),
		directiveDisplayState: {},
		displayModel,
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

export function createMockViewport(x = 0, y = 0, width = 800, height = 600): Viewport {
	return {
		x,
		y,
		width,
		height,
		...TEST_GRID_SIZE,
	};
}

/** Creates representative source for hand-built memory layout fixtures. */
export function createMockMemoryDeclarationSource(
	instruction: MemoryDeclarationInstruction,
	lineNumber: number,
	name?: string,
	elementCount = 1
): MemoryDeclarationLine {
	const diagnosticSource = { kind: 'block', projectBlockId: 0, projectGroupPath: ROOT_PROJECT_GROUP_PATH } as const;
	const identifier =
		name === undefined
			? undefined
			: ({ type: ArgumentType.IDENTIFIER, referenceKind: 'plain', scope: 'local', value: name } as const);
	if (isArrayMemoryDeclarationInstructionName(instruction)) {
		if (!identifier) throw new Error('Mock memory array declarations require a name');
		return {
			diagnosticSource,
			lineNumber,
			instruction,
			arguments: [identifier, { type: ArgumentType.LITERAL, isInteger: true, value: elementCount }],
		};
	}
	return {
		diagnosticSource,
		lineNumber,
		instruction,
		arguments: [identifier ?? { type: ArgumentType.LITERAL, isInteger: true, value: 0 }],
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
	const { project: projectOverrides, ...stateOverrides } = overrides;
	let rootLevel: ProjectLevel;
	let activeLevel: ProjectLevel;
	if (projectOverrides?.rootLevel && projectOverrides.activeLevel) {
		({ rootLevel, activeLevel } = projectOverrides);
	} else {
		rootLevel = {
			entries: [],
			path: '',
			blocks: [],
			...(projectOverrides?.rootLevel ?? projectOverrides?.activeLevel),
		};
		activeLevel = rootLevel;
	}
	const { rootLevel: _root, activeLevel: _active, ...projectStateOverrides } = projectOverrides ?? {};

	const defaults: State = {
		compilerInputRevision: 0,
		projectChange: { revision: 0, kind: 'replace' },
		compiler: {
			isCompiling: false,
			result: {
				inputRevision: null,
				compiledModules: {},
				memoryPlan: {
					modules: {},
					moduleList: [],
				},
				memoryDefaultsByModuleId: {},
				projectMemoryExposuresByGroupPath: {},
			},
		},
		callbacks: {},
		project: {
			rootLevel,
			activeLevel,
			entryBounds: [],
			nextCodeBlockCreationIndex: 0,
		},
		contextMenu: {
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
			canvasOverlays: true,
		},
		editorMode: 'edit',
		editorConfig: {},
		appearance: {},
		editorConfigValidators: {},
		editorConfigSchemaContributions: {},
		historyStack: [],
		redoStack: [],
		envConstantContributions: {},
		codeErrors: {},
		loadingIndicators: [],
		console: {
			logs: [],
			maxLogs: 100,
		},
		assertionResults: [],
		globalEditorDirectives: {},
		dialog: { id: '', text: '', title: '', buttons: [] },
		dialogStack: [],
		gridSizeReady: true,
		viewport: {
			x: 0,
			y: 0,
			width: 1024,
			height: 768,
			...TEST_GRID_SIZE,
		},
	};

	const state = mergeDeep<State>(defaults, { ...stateOverrides, project: projectStateOverrides });
	const initialize = (level: ProjectLevel, path: string): void => {
		level.path = path;
		for (const block of level.blocks) {
			if (block.childLevel) initialize(block.childLevel, path ? `${path}/${block.name}` : block.name);
		}
	};
	initialize(rootLevel, '');
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
