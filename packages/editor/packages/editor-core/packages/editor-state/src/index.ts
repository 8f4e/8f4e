import type {
	EditorDirectiveRegistry,
	EditorMenuRegistry,
	EventDispatcher,
	Options,
	State,
} from '@8f4e/editor-state-types';
import createStateManager, { type StateManager } from '@8f4e/state-manager';
import binaryAssetLoadingDialog from './features/binary-assets/effect';
import canvasScreenshot from './features/canvas-screenshot/effect';
import codeBlockRendering from './features/code-blocks/effect';
import assertions from './features/code-blocks/features/assertions/effect';
import autoEnvConstants from './features/code-blocks/features/auto-env-constants/effect';
import blockTypeUpdater from './features/code-blocks/features/blockTypeUpdater/effect';
import codeBlockCreator from './features/code-blocks/features/codeBlockCreator/effect';
import codeBlockDragger from './features/code-blocks/features/codeBlockDragger/effect';
import codeBlockNavigation from './features/code-blocks/features/codeBlockNavigation/effect';
import crossfade from './features/code-blocks/features/directives/crossfade/interaction';
import pianoKeyboard from './features/code-blocks/features/directives/piano/interaction';
import { createDirectiveRegistry } from './features/code-blocks/features/directives/registry';
import slider from './features/code-blocks/features/directives/slider/interaction';
import viewportDirectiveEffect from './features/code-blocks/features/directives/viewport/effect';
import entryOutlines from './features/code-blocks/features/entryOutlines/effect';
import favoriteToggler from './features/code-blocks/features/favoriteToggler/effect';
import groupCopier from './features/code-blocks/features/group/copier/effect';
import groupDeleter from './features/code-blocks/features/group/deleter/effect';
import groupNonstickToggler from './features/code-blocks/features/group/nonstickToggler/effect';
import groupRemover from './features/code-blocks/features/group/remover/effect';
import groupRowAligner from './features/code-blocks/features/group/rowAligner/effect';
import groupSkipExecutionToggler from './features/code-blocks/features/group/skipExecutionToggler/effect';
import groupUngroupper from './features/code-blocks/features/group/ungroupper/effect';
import memoryConnectionRemover from './features/code-blocks/features/memoryConnectionRemover/effect';
import parsedDirectivesUpdater from './features/code-blocks/features/parsedDirectivesUpdater/effect';
import projectGroupNavigation from './features/code-blocks/features/projectGroupNavigation/effect';
import sliderDefaultSaver from './features/code-blocks/features/sliderDefaultSaver/effect';
import codeEditing from './features/code-editing/effect';
import color from './features/color/effect';
import dialog from './features/dialog/effect';
import historyTracking from './features/edit-history/effect';
import { registerEditorConfigSchemaContributionsValidator } from './features/editor-config/schemaContributions';
import editorMode from './features/editor-mode/effect';
import font from './features/font/effect';
import globalEditorDirectivesEffect from './features/global-editor-directives/effect';
import contextMenu from './features/menu/effect';
import createMenuItemRegistry from './features/menu/itemRegistry';
import compiler from './features/program-compiler/effect';
import projectExport from './features/project-export/effect';
import projectImport from './features/project-import/effect';
import runtime from './features/runtime/effect';
import viewport from './features/viewport/effect';
import createDefaultState from './pureHelpers/state/createDefaultState';
import { validateFeatureFlags } from './pureHelpers/state/featureFlags';

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
	const menus = createMenuItemRegistry();
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
		runtimeRegistry: options.runtimeRegistry,
		editorConfigSchemaContributions: options.editorConfigSchemaContributions ?? {},
	};

	const store = createStateManager<State>(baseState);
	effectCleanups.push(store.dispose);

	registerEffect(font(store));
	registerEffect(color(store));
	registerEffect(registerEditorConfigSchemaContributionsValidator(store));
	registerEffect(projectExport(store, events));
	registerEffect(canvasScreenshot(store, events));
	registerEffect(dialog(store, events));
	// Menus must consume pointer events before code blocks and viewport interactions.
	registerEffect(contextMenu(store, events, menus));
	registerEffect(binaryAssetLoadingDialog(store, events));

	registerEffect(runtime(store, events));
	registerEffect(editorMode(store, events));
	registerEffect(projectImport(store, events));
	registerEffect(codeBlockDragger(store, events));
	registerEffect(codeBlockNavigation(store, events));
	registerEffect(slider(store, events));
	registerEffect(sliderDefaultSaver(store, events));
	registerEffect(memoryConnectionRemover(store, events));
	registerEffect(crossfade(store, events));
	registerEffect(pianoKeyboard(store, events));
	registerEffect(viewport(store, events));
	registerEffect(codeBlockCreator(store, events));
	registerEffect(groupSkipExecutionToggler(store, events));
	registerEffect(groupNonstickToggler(store, events));
	registerEffect(groupCopier(store, events));
	registerEffect(favoriteToggler(store, events));
	registerEffect(groupRemover(store, events));
	registerEffect(groupUngroupper(store, events));
	registerEffect(groupDeleter(store, events));
	registerEffect(groupRowAligner(store, events));
	registerEffect(projectGroupNavigation(store, events));
	registerEffect(parsedDirectivesUpdater(store));
	registerEffect(autoEnvConstants(store)); // Must run after codeBlockCreator to ensure env block is created
	registerEffect(blockTypeUpdater(store)); // Must run before compiler to classify blocks first
	registerEffect(globalEditorDirectivesEffect(store));
	registerEffect(compiler(store));
	registerEffect(codeBlockRendering(store, events, directives.definitions));
	registerEffect(assertions(store));
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
export { parseEditorDirectives } from './features/code-blocks/features/directives/utils';
// Export helper functions
export { default as findClosestCodeBlockInDirection } from './features/code-blocks/utils/finders/findClosestCodeBlockInDirection';
export { getCompiledFunctionForCodeBlock } from './features/code-blocks/utils/getCompiledFunctionForCodeBlock';
export { default as setSkipExecution } from './features/code-blocks/utils/setSkipExecution';
export { default as wrapText } from './features/code-blocks/utils/wrapText';
export { default as gapCalculator } from './features/code-editing/gapCalculator';
export { default as incrementCompilerInputRevision } from './features/program-compiler/incrementCompilerInputRevision';
// Export .8f4e format helpers
export { serializeProjectTo8f4e } from './features/project-export/serializeTo8f4e';
// Export EMPTY_DEFAULT_PROJECT as a value
export { EMPTY_DEFAULT_PROJECT } from './features/project-import/emptyDefaultProject';
export type { CodeBlockBounds } from './features/viewport/centerViewportOnCodeBlock';
export { default as centerViewportOnCodeBlock } from './features/viewport/centerViewportOnCodeBlock';
export {
	isMemoryAddress,
	isPointerSource,
	parseElementCount,
	parseFiniteNumber,
} from './shared/editorDirectiveArgumentTypes';
export { formatKnownStackValue } from './shared/formatKnownStackValue';
