import type {
	EditorDirectiveRegistry,
	EditorLayoutRegistry,
	EditorMenuRegistry,
	EventDispatcher,
	Options,
	State,
} from '@8f4e/editor-state-types';
import createStateManager, { type StateManager } from '@8f4e/state-manager';
import codeBlockRendering from './features/code-blocks/effect';
import autoEnvConstants from './features/code-blocks/features/auto-env-constants/effect';
import blockTypeUpdater from './features/code-blocks/features/blockTypeUpdater/effect';
import codeBlockCreator from './features/code-blocks/features/codeBlockCreator/effect';
import codeBlockDragger from './features/code-blocks/features/codeBlockDragger/effect';
import codeBlockNavigation from './features/code-blocks/features/codeBlockNavigation/effect';
import registerInfoLayout from './features/code-blocks/features/directives/info/layout';
import { createDirectiveRegistry } from './features/code-blocks/features/directives/registry';
import viewportDirectiveEffect from './features/code-blocks/features/directives/viewport/effect';
import entryOutlines from './features/code-blocks/features/entryOutlines/effect';
import parsedDirectivesUpdater from './features/code-blocks/features/parsedDirectivesUpdater/effect';
import projectGroupNavigation from './features/code-blocks/features/projectGroupNavigation/effect';
import { createLayoutRegistry } from './features/code-blocks/layout/registry';
import codeEditing from './features/code-editing/effect';
import color from './features/color/effect';
import dialog from './features/dialog/effect';
import historyTracking from './features/edit-history/effect';
import { registerExportFileNameEditorConfigValidator } from './features/editor-config/exportFileName';
import { registerEditorConfigSchemaContributionsValidator } from './features/editor-config/schemaContributions';
import editorMode from './features/editor-mode/effect';
import font from './features/font/effect';
import globalEditorDirectivesEffect from './features/global-editor-directives/effect';
import contextMenu from './features/menu/effect';
import createMenuRegistry from './features/menu/registry';
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

	registerEffect(font(store));
	registerEffect(color(store));
	registerEffect(registerEditorConfigSchemaContributionsValidator(store));
	registerExportFileNameEditorConfigValidator(store);
	registerEffect(dialog(store, events));
	// Menus must consume pointer events before code blocks and viewport interactions.
	registerEffect(contextMenu(store, events, menus));

	registerEffect(editorMode(store, events));
	registerEffect(projectLoading(store, events));
	registerEffect(codeBlockDragger(store, events));
	registerEffect(codeBlockNavigation(store, events));
	registerEffect(viewport(store, events));
	registerEffect(codeBlockCreator(store, events));
	registerEffect(projectGroupNavigation(store, events));
	registerEffect(parsedDirectivesUpdater(store));
	registerEffect(autoEnvConstants(store)); // Must run after codeBlockCreator to ensure env block is created
	registerEffect(blockTypeUpdater(store)); // Classify blocks before announcing compiler input changes
	registerEffect(globalEditorDirectivesEffect(store));
	registerEffect(publishCompilationInputChanges(store, events));
	registerEffect(codeBlockRendering(store, events, directives.definitions, layout));
	registerEffect(registerInfoLayout(layout));
	registerEffect(viewportDirectiveEffect(store, events));
	registerEffect(entryOutlines(store));
	registerEffect(codeEditing(store, events));
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
		dispose,
	};
}

// Export helper functions
export { deleteCodeBlocks } from './features/code-blocks/deleteCodeBlocks';
export type { ClipboardCodeBlock } from './features/code-blocks/features/clipboard/clipboardUtils';
export { serializeCodeBlocksToClipboard } from './features/code-blocks/features/clipboard/clipboardUtils';
export type { TransformPastedCodeBlocksEvent } from './features/code-blocks/features/codeBlockCreator/pasteMultipleBlocks';
export type { ResolveCodeBlockDragTargetsEvent } from './features/code-blocks/features/codeBlockDragger/effect';
export { navigateToCodeBlockInDirection } from './features/code-blocks/features/codeBlockNavigation/effect';
export {
	removeDirective,
	updateDirectiveArgs,
	upsertDirective,
} from './features/code-blocks/features/directiveEditing';
export { matchEditorDirectives } from './features/code-blocks/features/directives/utils';
export { default as getCodeBlockGridWidth } from './features/code-blocks/getCodeBlockGridWidth';
export { applyCodeBlockSourceEdits } from './features/code-blocks/sourceEdits';
export { default as getBlockType } from './features/code-blocks/utils/codeParsers/getBlockType';
export { default as findClosestCodeBlockInDirection } from './features/code-blocks/utils/finders/findClosestCodeBlockInDirection';
export { default as getCodeBlockNameFromSource } from './features/code-blocks/utils/getCodeBlockNameFromSource';
export { getCompiledFunctionForCodeBlock } from './features/code-blocks/utils/getCompiledFunctionForCodeBlock';
export { parseBlockDirectives } from './features/code-blocks/utils/parseBlockDirectives';
export { default as setSkipExecution } from './features/code-blocks/utils/setSkipExecution';
export { default as wrapText } from './features/code-blocks/utils/wrapText';
export { default as gapCalculator } from './features/code-editing/gapCalculator';
export { getTabStopsByLine, getVisualLineWidth } from './features/code-editing/tabLayout';
export { error as logError, log as logMessage } from './features/logger/logger';
export { default as incrementCompilerInputRevision } from './features/program-compiler/incrementCompilerInputRevision';
export { publishProjectChange } from './features/project-changes';
// Export EMPTY_DEFAULT_PROJECT as a value
export { EMPTY_DEFAULT_PROJECT } from './features/project-loading/emptyDefaultProject';
export type { CodeBlockBounds } from './features/viewport/centerViewportOnCodeBlock';
export { default as centerViewportOnCodeBlock } from './features/viewport/centerViewportOnCodeBlock';
export { default as getCodeBlockModuleId } from './pureHelpers/getCodeBlockModuleId';
// Export project serialization helpers
export { default as getExportBaseName } from './pureHelpers/getExportBaseName';
export { getUniqueName } from './pureHelpers/getUniqueName';
export { default as serializeCodeBlocksToProject } from './pureHelpers/projectSerialization/serializeCodeBlocks';
export { serializeProjectTo8f4e } from './pureHelpers/projectSerialization/serializeTo8f4e';
export { default as serializeToProject } from './pureHelpers/projectSerialization/serializeToProject';
export {
	isMemoryAddress,
	isPointerSource,
	parseElementCount,
	parseFiniteNumber,
	parseInteger,
} from './shared/editorDirectiveArgumentTypes';
export { formatInfoValue, isRenderableInfoValue } from './shared/formatInfoValue';
export { formatKnownStackValue } from './shared/formatKnownStackValue';
