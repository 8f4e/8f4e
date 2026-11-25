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
import { createProjectMembership } from './project/membership';
import registerProjectLoading from './project/projectLoading';
import { createProjectTransactionService, type ProjectTransactionService } from './project/transactions';
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
	const cleanups: Array<() => void> = [];

	// Create base state
	const baseState = {
		...createDefaultEditorState(options.featureFlags),
		callbacks: options.callbacks,
		editorConfigSchemaContributions: options.editorConfigSchemaContributions ?? {},
	};

	const store = createStateManager<State>(baseState);
	cleanups.push(store.dispose);

	registerEditorConfigSchemaContributionsValidator(store);
	registerExportFileNameEditorConfigValidator(store);
	cleanups.push(registerDialogHandlers(store, events));
	// Menus must consume pointer events before code blocks and viewport interactions.
	cleanups.push(registerContextMenuHandlers(store, events, menus));

	cleanups.push(registerEditorModeHandlers(store, events));
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
	cleanups.push(registerPointerCaretSelection(store, events));
	cleanups.push(trackBlockLayout(store, events, coordinator));
	const editingStore = { ...store, projectTransactions };
	cleanups.push(registerProjectLoading(projectTransactions, events));
	cleanups.push(registerBlockDragging(editingStore, events));
	cleanups.push(registerPointerRouting(store, events));
	cleanups.push(registerBlockNavigation(store, events));
	cleanups.push(registerViewportHandlers(store, events));
	cleanups.push(registerBlockActionCommands(editingStore, events));
	cleanups.push(registerGroupNavigation(store, events));
	cleanups.push(trackEntryBounds(store, events));

	const dispose = () => {
		while (cleanups.length) {
			cleanups.pop()!();
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
