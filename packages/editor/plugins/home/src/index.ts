import type { EditorPlugin } from '@8f4e/editor-core';
import {
	centerViewportOnCodeBlock,
	matchEditorDirectives,
	updateViewport,
	walkProjectLevels,
} from '@8f4e/editor-state';
import type { CodeError, EditorLifecycleEvents, ProjectLevel, ViewportBlockAlignment } from '@8f4e/editor-state-types';

const directiveDefinitions = [{ name: 'home' }];

function parseAlignment(args: string[]): ViewportBlockAlignment | undefined {
	if (args.length > 1) return;
	const alignment = args[0] ?? 'center';
	if (
		alignment === 'center' ||
		alignment === 'left' ||
		alignment === 'right' ||
		alignment === 'top' ||
		alignment === 'bottom'
	)
		return alignment;
}

function findHome(project: ProjectLevel) {
	for (const codeBlock of project.blocks) {
		let alignment: ViewportBlockAlignment | undefined;
		for (const directive of matchEditorDirectives(codeBlock.parsedDirectives, directiveDefinitions)) {
			alignment = parseAlignment(directive.args) ?? alignment;
		}
		if (alignment !== undefined) return { codeBlock, alignment };
	}
}

function findDuplicateHomeErrors(rootProject: ProjectLevel): CodeError[] {
	const errors: CodeError[] = [];
	for (const project of walkProjectLevels(rootProject)) {
		let seenHome = false;
		// Diagnostic ownership must not follow the mutable draw order used by navigation.
		for (const block of [...project.blocks].sort((a, b) => a.creationIndex - b.creationIndex)) {
			for (const directive of matchEditorDirectives(block.parsedDirectives, directiveDefinitions)) {
				if (seenHome) {
					errors.push({
						codeBlockId: block.creationIndex,
						lineNumber: directive.sourceLineIndex,
						message: 'Duplicate @home directive in this project level.',
					});
				}
				seenHome = true;
			}
		}
	}
	return errors;
}

export const homePlugin: EditorPlugin = {
	id: 'home',
	setup: ({ store, events, menus }) => {
		const state = store.getState();
		let pendingHome: { project: ProjectLevel; select: boolean } | undefined;
		const clearPendingHome = () => {
			pendingHome = undefined;
		};
		const onCurrentProjectChanged = (project: ProjectLevel) => {
			if (pendingHome && pendingHome.project !== project) clearPendingHome();
		};
		const onViewportChanged = ({ source }: EditorLifecycleEvents['viewportChanged']) => {
			if (source !== undefined) clearPendingHome();
		};
		const refreshErrors = () => {
			const errors = findDuplicateHomeErrors(state.codeBlockRendering.rootProject);
			const previous = state.codeErrors.home ?? [];
			if (
				errors.length !== previous.length ||
				errors.some(
					(error, index) =>
						error.codeBlockId !== previous[index].codeBlockId ||
						error.lineNumber !== previous[index].lineNumber ||
						error.message !== previous[index].message
				)
			) {
				store.set('codeErrors.home', errors);
			}
		};
		const onResolveInitialProjectViewport = (event: EditorLifecycleEvents['resolveInitialProjectViewport']) => {
			if (!state.gridSizeReady) {
				if (event.project === state.codeBlockRendering.currentProject) {
					pendingHome = { project: event.project, select: false };
				}
				return;
			}
			const home = findHome(event.project);
			if (home) {
				Object.assign(
					event.position,
					centerViewportOnCodeBlock(state.viewport, home.codeBlock, { alignment: home.alignment })
				);
			}
		};
		const moveToHome = (project: ProjectLevel, select: boolean) => {
			const home = findHome(project);
			if (!home && !select) return;
			if (home && select) store.set('codeBlockRendering.selectedCodeBlock', home.codeBlock);
			const { x, y } = home
				? centerViewportOnCodeBlock(state.viewport, home.codeBlock, { alignment: home.alignment })
				: { x: 0, y: 0 };
			updateViewport(state, x, y, events, select ? 'navigation' : undefined);
		};
		const onGridSizeReady = () => {
			const pending = pendingHome;
			clearPendingHome();
			if (pending?.project === state.codeBlockRendering.currentProject) {
				moveToHome(pending.project, pending.select);
			}
		};
		const onGoHome = () => {
			const project = state.codeBlockRendering.currentProject;
			if (!state.gridSizeReady && findHome(project)) {
				pendingHome = { project, select: true };
				return;
			}
			clearPendingHome();
			moveToHome(project, true);
		};

		store.subscribe('projectChange', refreshErrors);
		store.subscribe('codeBlockRendering.currentProject', onCurrentProjectChanged);
		refreshErrors();
		events.on('resolveInitialProjectViewport', onResolveInitialProjectViewport);
		events.on('gridSizeReady', onGridSizeReady);
		events.on('viewportChanged', onViewportChanged);
		events.on('goHome', onGoHome);
		const unregisterMenuItem = menus.registerItem('mainMenu', ({ state }) => {
			if (state.editorMode === 'edit') return { title: 'Go @home', action: 'goHome', close: true };
		});
		return () => {
			unregisterMenuItem();
			clearPendingHome();
			events.off('resolveInitialProjectViewport', onResolveInitialProjectViewport);
			events.off('gridSizeReady', onGridSizeReady);
			events.off('viewportChanged', onViewportChanged);
			events.off('goHome', onGoHome);
			store.unsubscribe('codeBlockRendering.currentProject', onCurrentProjectChanged);
			store.unsubscribe('projectChange', refreshErrors);
			if (state.codeErrors.home !== undefined) {
				const errors = { ...state.codeErrors };
				delete errors.home;
				store.set('codeErrors', errors);
			}
		};
	},
};
