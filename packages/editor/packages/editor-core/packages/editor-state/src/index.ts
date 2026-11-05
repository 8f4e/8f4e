import type {
	EditorDirectiveRegistry,
	EditorLayoutRegistry,
	EditorLoadingRegistry,
	EditorMenuRegistry,
	EventDispatcher,
	Options,
	State,
} from '@8f4e/editor-state-types';
import createStateManager, { type StateManager } from '@8f4e/state-manager';
import codeBlockRendering from './features/code-blocks/effect';
import autoEnvConstants from './features/code-blocks/features/auto-env-constants/effect';
import codeBlockCreator from './features/code-blocks/features/codeBlockCreator/effect';
import codeBlockDragger from './features/code-blocks/features/codeBlockDragger/effect';
import codeBlockNavigation from './features/code-blocks/features/codeBlockNavigation/effect';
import { createDirectiveRegistry } from './features/code-blocks/features/directives/registry';
import viewportDirectiveEffect from './features/code-blocks/features/directives/viewport/effect';
import entryBounds from './features/code-blocks/features/entryBounds/effect';
import projectGroupNavigation from './features/code-blocks/features/projectGroupNavigation/effect';
import { createLayoutRegistry } from './features/code-blocks/layout/registry';
import dialog from './features/dialog/effect';
import historyTracking from './features/edit-history/effect';
import { registerExportFileNameEditorConfigValidator } from './features/editor-config/exportFileName';
import { registerEditorConfigSchemaContributionsValidator } from './features/editor-config/schemaContributions';
import editorMode from './features/editor-mode/effect';
import { createLoadingRegistry } from './features/loading-indicators';
import contextMenu from './features/menu/effect';
import createMenuRegistry from './features/menu/registry';
import pointerInput from './features/pointer-input/effect';
import publishCompilationInputChanges from './features/program-compiler/inputChanges';
import projectLoading from './features/project-loading/effect';
import projectOperations from './features/project-operations/effect';
import viewport from './features/viewport/effect';
import createDefaultState from './pureHelpers/state/createDefaultState';
import { validateFeatureFlags } from './pureHelpers/state/featureFlags';

export type {
	EditorEdit,
	EditorEditingHandle,
	EditorEditResult,
	EditorNavigationHandle,
} from './editing';

export { createEditorEditingHandle, EditorEditingError, getEditorBlockId } from './editing';
export {
	collectSchemaConfigPaths,
	createSchemaEditorConfigValidator,
	getSchemaForConfigPath,
	parseSchemaConfigValue,
	resolveSchemaConfigRoot,
	validateSchemaConfigValue,
} from './features/editor-config/schemaValidator';

// Function to create default state
export default function init(
	events: EventDispatcher,
	options: Options
): StateManager<State> & {
	menus: EditorMenuRegistry;
	directives: EditorDirectiveRegistry;
	layout: EditorLayoutRegistry;
	loading: EditorLoadingRegistry;
} {
	const menus = createMenuRegistry();
	const directives = createDirectiveRegistry();
	const layout = createLayoutRegistry(codeBlock =>
		events.dispatch('codeBlockLayoutContributionsChanged', { codeBlock })
	);
	const featureFlags = validateFeatureFlags(options.featureFlags);
	type EffectCleanup = () => void;
	const effectCleanups: EffectCleanup[] = [];
	const registerEffect = (cleanup: void | EffectCleanup): void => {
		if (cleanup !== undefined) {
			effectCleanups.push(cleanup);
		}
	};

	// Create base state
	const baseState = {
		...createDefaultState(),
		callbacks: options.callbacks,
		featureFlags,
		editorConfigSchemaContributions: options.editorConfigSchemaContributions ?? {},
	};

	const store = createStateManager<State>(baseState);
	effectCleanups.push(store.dispose);

	registerEffect(registerEditorConfigSchemaContributionsValidator(store));
	registerExportFileNameEditorConfigValidator(store);
	registerEffect(dialog(store, events));
	// Menus must consume pointer events before code blocks and viewport interactions.
	registerEffect(contextMenu(store, events, menus));

	registerEffect(editorMode(store, events));
	registerEffect(projectLoading(store, events));
	registerEffect(codeBlockDragger(store, events));
	registerEffect(pointerInput(store, events));
	registerEffect(codeBlockNavigation(store, events));
	registerEffect(viewport(store, events));
	registerEffect(codeBlockCreator(store, events));
	registerEffect(projectGroupNavigation(store, events));
	registerEffect(autoEnvConstants(store)); // Must run after codeBlockCreator to ensure env block is created
	registerEffect(publishCompilationInputChanges(store, events));
	registerEffect(codeBlockRendering(store, events, directives.definitions, layout));
	registerEffect(viewportDirectiveEffect(store, events));
	registerEffect(entryBounds(store, events));
	registerEffect(projectOperations(store, events));
	registerEffect(historyTracking(store, events));

	const onConsoleLog = (event: unknown) => {
		console.log(event);
	};
	events.on('consoleLog', onConsoleLog);
	registerEffect(() => events.off('consoleLog', onConsoleLog));

	const dispose = () => {
		while (effectCleanups.length) {
			effectCleanups.pop()!();
		}
	};
	return {
		...store,
		menus,
		directives,
		layout,
		loading: createLoadingRegistry(store),
		dispose,
	};
}

// Export helper functions
export { deleteCodeBlocks } from './features/code-blocks/deleteCodeBlocks';
export type { ResolveCodeBlockDragTargetsEvent } from './features/code-blocks/features/codeBlockDragger/effect';
export {
	jumpToCodeBlock,
	navigateToCodeBlockInDirection,
} from './features/code-blocks/features/codeBlockNavigation/effect';
export {
	removeDirective,
	updateDirectiveArgs,
	upsertDirective,
} from './features/code-blocks/features/directiveEditing';
export { matchEditorDirectives } from './features/code-blocks/features/directives/utils';
export { default as getCodeBlockGridWidth } from './features/code-blocks/getCodeBlockGridWidth';
export { insertCodeBlocks } from './features/code-blocks/insertCodeBlocks';
export { applyCodeBlockSourceEdits } from './features/code-blocks/sourceEdits';
export { default as getBlockType } from './features/code-blocks/utils/codeParsers/getBlockType';
export { default as findClosestCodeBlockInDirection } from './features/code-blocks/utils/finders/findClosestCodeBlockInDirection';
export { default as getCodeBlockNameFromSource } from './features/code-blocks/utils/getCodeBlockNameFromSource';
export { getCompiledFunctionForCodeBlock } from './features/code-blocks/utils/getCompiledFunctionForCodeBlock';
export {
	type CodeBlockModuleCompilation,
	getCompiledModuleForCodeBlock,
	getModuleCompilationForCodeBlock,
} from './features/code-blocks/utils/getCompiledModuleForCodeBlock';
export { parseBlockDirectives } from './features/code-blocks/utils/parseBlockDirectives';
export { default as setSkipExecution } from './features/code-blocks/utils/setSkipExecution';
export { default as wrapText } from './features/code-blocks/utils/wrapText';
export { default as resolveEditorConfig } from './features/global-editor-directives/resolve';
export { error as logError, log as logMessage } from './features/logger/logger';
export { default as incrementCompilerInputRevision } from './features/program-compiler/incrementCompilerInputRevision';
export { publishProjectChange } from './features/project-changes';
// Export EMPTY_DEFAULT_PROJECT as a value
export { EMPTY_DEFAULT_PROJECT } from './features/project-loading/emptyDefaultProject';
export { clampSourcePosition } from './features/text-geometry/clampSourcePosition';
export { default as gapCalculator } from './features/text-geometry/gapCalculator';
export {
	getRawIndexForVisualColumn,
	getTabAdvance,
	getTabStopsByLine,
	getVisualColumnForRawIndex,
	getVisualLineWidth,
} from './features/text-geometry/tabLayout';
export { advanceViewportAnimation, stopViewportAnimation } from './features/viewport/animateViewport';
export type { CodeBlockBounds } from './features/viewport/centerViewportOnCodeBlock';
export { default as centerViewportOnCodeBlock } from './features/viewport/centerViewportOnCodeBlock';
export { default as snapToGrid } from './features/viewport/snapToGrid';
export { default as updateViewport } from './features/viewport/updateViewport';
export { type SerializedCodeBlock, serializeCodeBlocks } from './pureHelpers/codeBlockSerialization';
export { default as getCodeBlockErrors } from './pureHelpers/getCodeBlockErrors';
export { default as getCodeBlockModuleId } from './pureHelpers/getCodeBlockModuleId';
// Export project serialization helpers
export { default as getExportBaseName } from './pureHelpers/getExportBaseName';
export { default as serializeProjectLevel } from './pureHelpers/projectSerialization/serializeProjectLevel';
export { default as serializeToProject } from './pureHelpers/projectSerialization/serializeToProject';
export {
	findParentProjectLevel,
	findProjectLevel,
	walkProjectBlocks,
	walkProjectLevels,
} from './pureHelpers/projectTree';
export {
	isMemoryAddress,
	isMemoryId,
	isPointerSource,
	parseElementCount,
	parseFiniteNumber,
	parseInteger,
} from './shared/editorDirectiveArgumentTypes';
export { formatKnownStackValue } from './shared/formatKnownStackValue';
