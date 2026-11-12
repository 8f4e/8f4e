import type { ProjectChange, ProjectLevel } from '@8f4e/editor-state-types';
import { defaultFeatureFlags } from './featureFlags';

export default function createDefaultState() {
	const rootProject: ProjectLevel = { entries: [], path: '', blocks: [] };

	return {
		compilerInputRevision: 0,
		projectChange: { revision: 0, kind: 'replace' } satisfies ProjectChange,
		compiler: {
			resultInputRevision: null,
			resultSourceCodeByBlockId: {},
			isCompiling: false,
			result: {
				compiledModules: {},
				memoryPlan: {
					modules: {},
					moduleList: [],
				},
				memoryDefaultsByModuleId: {},
				projectMemoryExposuresByGroupPath: {},
			},
		},
		codeBlockRendering: {
			rootProject,
			currentProject: rootProject,
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
		featureFlags: defaultFeatureFlags,
		editorMode: 'view' as const,
		editorConfig: {},
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
		globalEditorDirectives: {},
		assertionResults: [],
		dialog: { id: '', text: '', title: '', buttons: [] },
		dialogStack: [],
		viewport: {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			roundedHeight: 0,
			roundedWidth: 0,
			vGrid: 8,
			hGrid: 16,
		},
		viewportAnimation: {
			startX: 0,
			startY: 0,
			targetX: 0,
			targetY: 0,
			active: false,
		},
	};
}
