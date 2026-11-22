import type { EditorPlugin } from '@8f4e/editor-core';
import { centerViewportOnCodeBlock, matchEditorDirectives, updateViewport } from '@8f4e/editor-state';
import type { EditorLifecycleEvents, ProjectLevel, ViewportBlockAlignment } from '@8f4e/editor-state-types';

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

export const homePlugin: EditorPlugin = {
	id: 'home',
	setup: ({ store, events, menus }) => {
		const state = store.getState();
		const onResolveInitialProjectViewport = (event: EditorLifecycleEvents['resolveInitialProjectViewport']) => {
			const home = findHome(event.project);
			if (home) {
				Object.assign(
					event.position,
					centerViewportOnCodeBlock(state.viewport, home.codeBlock, { alignment: home.alignment })
				);
			}
		};
		const onGoHome = () => {
			const home = findHome(state.codeBlockRendering.currentProject);
			if (home) store.set('codeBlockRendering.selectedCodeBlock', home.codeBlock);
			const { x, y } = home
				? centerViewportOnCodeBlock(state.viewport, home.codeBlock, { alignment: home.alignment })
				: { x: 0, y: 0 };
			updateViewport(state, x, y, events, 'navigation');
		};

		events.on('resolveInitialProjectViewport', onResolveInitialProjectViewport);
		events.on('goHome', onGoHome);
		const unregisterMenuItem = menus.registerItem('mainMenu', ({ state }) => {
			if (state.editorMode === 'edit') return { title: 'Go @home', action: 'goHome', close: true };
		});
		return () => {
			unregisterMenuItem();
			events.off('resolveInitialProjectViewport', onResolveInitialProjectViewport);
			events.off('goHome', onGoHome);
		};
	},
};
