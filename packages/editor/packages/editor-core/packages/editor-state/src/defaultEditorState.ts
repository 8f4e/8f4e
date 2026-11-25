import type { FeatureFlagsConfig, ProjectChange, ProjectLevel } from '@8f4e/editor-state-types';

export default function createDefaultEditorState(featureFlags: FeatureFlagsConfig = {}) {
	const rootLevel: ProjectLevel = { entries: [], path: '', blocks: [] };

	return {
		compilerInputRevision: 0,
		projectChange: { revision: 0, kind: 'replace' } satisfies ProjectChange,
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
		project: {
			rootLevel,
			activeLevel: rootLevel,
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
			...featureFlags,
		},
		editorMode: 'view' as const,
		editorConfig: {},
		appearance: {},
		editorConfigValidators: {},
		editorConfigSchemaContributions: {},
		envConstantContributions: {},
		codeErrors: {},
		loadingIndicators: [],
		console: {
			logs: [],
			maxLogs: 100,
		},
		globalEditorDirectives: {},
		assertionResults: [],
		dialog: { id: '', text: '', title: '', buttons: [] },
		dialogStack: [],
		gridSizeReady: false,
		viewport: {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			vGrid: 0,
			hGrid: 0,
		},
	};
}
