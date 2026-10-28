import type {
	EditorDirectiveRegistry,
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
import { createDirectiveRegistry } from './features/code-blocks/features/directives/registry';
import viewportDirectiveEffect from './features/code-blocks/features/directives/viewport/effect';
import entryOutlines from './features/code-blocks/features/entryOutlines/effect';
import groupCopier from './features/code-blocks/features/group/copier/effect';
import groupDeleter from './features/code-blocks/features/group/deleter/effect';
import groupNonstickToggler from './features/code-blocks/features/group/nonstickToggler/effect';
import groupRemover from './features/code-blocks/features/group/remover/effect';
import groupRowAligner from './features/code-blocks/features/group/rowAligner/effect';
import groupSkipExecutionToggler from './features/code-blocks/features/group/skipExecutionToggler/effect';
import groupUngroupper from './features/code-blocks/features/group/ungroupper/effect';
import parsedDirectivesUpdater from './features/code-blocks/features/parsedDirectivesUpdater/effect';
import projectGroupNavigation from './features/code-blocks/features/projectGroupNavigation/effect';
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
import runtime from './features/runtime/effect';
import viewport from './features/viewport/effect';
import createDefaultState from './pureHelpers/state/createDefaultState';
import { validateFeatureFlags } from './pureHelpers/state/featureFlags';

export type {
	EditorEdit,
	EditorEditingHandle,
	EditorEditResult,
	EditorProjectSnapshot,
} from './editing';

export { createEditorEditingHandle, EditorEditingError } from './editing';
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
} {
	const menus = createMenuRegistry();
	const directives = createDirectiveRegistry();
	const initialEditorMode = options.initialEditorMode ?? (options.featureFlags?.editing ? 'edit' : 'view');
	const featureFlags = validateFeatureFlags({
		...options.featureFlags,
		editing: initialEditorMode === 'edit',
	});
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
		editorMode: initialEditorMode,
		featureFlags,
		runtimeRegistry: {},
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

	registerEffect(runtime(store, events, options.runtimeRegistry));
	registerEffect(editorMode(store, events));
	registerEffect(projectLoading(store, events));
	registerEffect(codeBlockDragger(store, events));
	registerEffect(codeBlockNavigation(store, events));
	registerEffect(viewport(store, events));
	registerEffect(codeBlockCreator(store, events));
	registerEffect(groupSkipExecutionToggler(store, events));
	registerEffect(groupNonstickToggler(store, events));
	registerEffect(groupCopier(store, events));
	registerEffect(groupRemover(store, events));
	registerEffect(groupUngroupper(store, events));
	registerEffect(groupDeleter(store, events));
	registerEffect(groupRowAligner(store, events));
	registerEffect(projectGroupNavigation(store, events));
	registerEffect(parsedDirectivesUpdater(store));
	registerEffect(autoEnvConstants(store)); // Must run after codeBlockCreator to ensure env block is created
	registerEffect(blockTypeUpdater(store)); // Classify blocks before announcing compiler input changes
	registerEffect(globalEditorDirectivesEffect(store));
	registerEffect(publishCompilationInputChanges(store, events));
	registerEffect(codeBlockRendering(store, events, directives.definitions));
	registerEffect(viewportDirectiveEffect(store, events));
	registerEffect(entryOutlines(store));
	registerEffect(codeEditing(store, events));
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
		dispose,
	};
}

export { navigateToCodeBlockInDirection } from './features/code-blocks/features/codeBlockNavigation/effect';
export { removeDirective } from './features/code-blocks/features/directiveEditing';
export { parseEditorDirectives } from './features/code-blocks/features/directives/utils';
// Export helper functions
export { default as getCodeBlockGridWidth } from './features/code-blocks/getCodeBlockGridWidth';
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
// Export EMPTY_DEFAULT_PROJECT as a value
export { EMPTY_DEFAULT_PROJECT } from './features/project-loading/emptyDefaultProject';
export type { CodeBlockBounds } from './features/viewport/centerViewportOnCodeBlock';
export { default as centerViewportOnCodeBlock } from './features/viewport/centerViewportOnCodeBlock';
export { default as getCodeBlockModuleId } from './pureHelpers/getCodeBlockModuleId';
// Export project serialization helpers
export { default as getExportBaseName } from './pureHelpers/getExportBaseName';
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
export { formatKnownStackValue } from './shared/formatKnownStackValue';
