import type {
	EditorLayoutRegistry,
	EditorLoadingRegistry,
	EditorMenuRegistry,
	EventDispatcher,
	Options,
	State,
} from '@8f4e/editor-state-types';
import createStateManager, { type StateManager } from '@8f4e/state-manager';
import createDefaultEditorState from './defaultEditorState';
import { createBlockDirectiveRegistry } from './directives/blockDirectiveRegistry';
import { registerExportFileNameEditorConfigValidator } from './editor-config/exportFileName';
import { registerEditorConfigSchemaContributionsValidator } from './editor-config/schemaContributionValidator';
import { validateFeatureFlags } from './featureFlags';
import registerBlockDragging from './input/blockDragging';
import registerBlockNavigation from './input/blockNavigation';
import registerEditorModeHandlers from './input/editorMode';
import registerPointerCaretSelection from './input/pointerCaretSelection';
import registerPointerRouting from './input/pointerRouting';
import { createLayoutCoordinator } from './layout/blockLayoutCoordinator';
import { createLayoutRegistry } from './layout/layoutContributionRegistry';
import trackBlockLayout from './layout/trackBlockLayout';
import registerBlockActionCommands from './project/blockActionCommands';
import trackEntryBounds from './project/entries/trackEntryBounds';
import registerGroupNavigation from './project/groupNavigation';
import registerProjectLoadCommands from './project/loadCommands';
import { createProjectMembership } from './project/membership';
import { createProjectTransactionService, type ProjectTransactionService } from './project/transactions';
import registerUndoRedo from './project/undoRedo';
import registerDialogHandlers from './ui-state/dialog/dialogHandlers';
import { createLoadingRegistry } from './ui-state/loadingRegistry';
import registerContextMenuHandlers from './ui-state/menu/contextMenuHandlers';
import createMenuRegistry from './ui-state/menu/menuRegistry';
import registerViewportHandlers from './viewport/panAndResize';

export type EditorStateStore = StateManager<State> & {
	menus: EditorMenuRegistry;
	directives: ReturnType<typeof createBlockDirectiveRegistry>;
	layout: EditorLayoutRegistry;
	loading: EditorLoadingRegistry;
	projectTransactions: ProjectTransactionService;
};

export default function initializeEditorState(events: EventDispatcher, options: Options): EditorStateStore {
	const menus = createMenuRegistry();
	const directives = createBlockDirectiveRegistry();
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
		...createDefaultEditorState(),
		callbacks: options.callbacks,
		featureFlags,
		editorConfigSchemaContributions: options.editorConfigSchemaContributions ?? {},
	};

	const store = createStateManager<State>(baseState);
	effectCleanups.push(store.dispose);

	registerEffect(registerEditorConfigSchemaContributionsValidator(store));
	registerExportFileNameEditorConfigValidator(store);
	registerEffect(registerDialogHandlers(store, events));
	// Menus must consume pointer events before code blocks and viewport interactions.
	registerEffect(registerContextMenuHandlers(store, events, menus));

	registerEffect(registerEditorModeHandlers(store, events));
	const state = store.getState();
	const membership = createProjectMembership(state.project.rootLevel);
	const coordinator = createLayoutCoordinator(state, events, layout, membership);
	const projectTransactions = createProjectTransactionService(
		store,
		events,
		directives.definitions,
		membership,
		coordinator
	);
	registerEffect(registerPointerCaretSelection(store, events));
	registerEffect(trackBlockLayout(store, events, coordinator));
	const editingStore = { ...store, projectTransactions };
	registerEffect(registerProjectLoadCommands(projectTransactions, events));
	registerEffect(registerBlockDragging(editingStore, events));
	registerEffect(registerPointerRouting(store, events));
	registerEffect(registerBlockNavigation(store, events));
	registerEffect(registerViewportHandlers(store, events));
	registerEffect(registerBlockActionCommands(editingStore, events));
	registerEffect(registerGroupNavigation(store, events));
	registerEffect(trackEntryBounds(store, events));
	registerEffect(registerUndoRedo(store, events, projectTransactions));

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
		...editingStore,
		menus,
		directives,
		layout,
		loading: createLoadingRegistry(store),
		dispose,
	};
}
