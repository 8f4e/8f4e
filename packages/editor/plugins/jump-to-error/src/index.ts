import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import {
	createCodeErrorBlockLookup,
	gapCalculator,
	stopViewportAnimation,
	updateViewport,
	walkProjectBlocks,
} from '@8f4e/editor-state';
import type { InternalPointerEvent, State } from '@8f4e/editor-state-types';

const LABEL = 'Jump to error';

function findTarget(state: State) {
	const errors = Object.values(state.codeErrors).flat();
	if (!errors.length) return;
	const findBlock = createCodeErrorBlockLookup(state.codeBlockRendering.rootProject);
	for (const error of errors) {
		const codeBlock = findBlock(error);
		if (codeBlock && error.lineNumber >= 0 && error.lineNumber < codeBlock.code.length) return { error, codeBlock };
	}
}

function buttonBounds(state: State) {
	const { width, height, vGrid, hGrid } = state.viewport;
	const buttonWidth = (LABEL.length + 2) * vGrid;
	return {
		x: Math.max(0, width - buttonWidth - vGrid),
		y: Math.max(0, height - 4 * hGrid),
		width: buttonWidth,
		height: 3 * hGrid,
	};
}

export function createJumpToErrorPlugin({ layer }: { layer: number }): EditorPlugin {
	return {
		id: 'jump-to-error',
		setup: ({ store, events, drawers }) => {
			const state = store.getState();
			let target = findTarget(state);
			const refreshTarget = () => {
				target = findTarget(state);
			};
			store.subscribe('codeErrors', refreshTarget);
			store.subscribe('projectChange', refreshTarget);
			store.subscribe('codeBlockRendering.rootProject', refreshTarget);
			let pressed = false;
			const onPointerDown = (event: InternalPointerEvent) => {
				pressed = false;
				if (
					event.buttons !== 1 ||
					!state.featureFlags.canvasOverlays ||
					state.dialogStack.length > 0 ||
					state.contextMenu.open
				)
					return;
				const button = buttonBounds(state);
				if (
					event.x < button.x ||
					event.x >= button.x + button.width ||
					event.y < button.y ||
					event.y >= button.y + button.height
				)
					return;
				refreshTarget();
				if (!target) return;
				event.stopPropagation = true;
				pressed = true;
				const { codeBlock, error } = target;
				const { rootProject, currentProject } = state.codeBlockRendering;
				if (!currentProject.blocks.includes(codeBlock)) {
					const parent = [...walkProjectBlocks(rootProject)].find(block =>
						block.childProject?.blocks.includes(codeBlock)
					);
					if (parent) events.dispatch('openProjectGroup', { codeBlock: parent });
					else events.dispatch('goToRootProjectGroup');
				}
				store.set('codeBlockRendering.selectedCodeBlock', codeBlock);
				// Selection reveals folded source before resolving its displayed row.
				const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[error.lineNumber];
				if (row === undefined) return;
				const lineY = codeBlock.y + (gapCalculator(row, codeBlock.gaps) + 0.5) * state.viewport.hGrid;
				stopViewportAnimation(state);
				updateViewport(
					state,
					codeBlock.x + codeBlock.width / 2 - state.viewport.width / 2,
					lineY - state.viewport.height / 2,
					events
				);
			};
			const onPointerMove = (event: InternalPointerEvent) => {
				if (event.buttons === 0) pressed = false;
				if (pressed) event.stopPropagation = true;
			};
			const release = (event: InternalPointerEvent) => {
				if (pressed) event.stopPropagation = true;
				pressed = false;
			};
			const reset = () => {
				pressed = false;
			};
			const removeDrawer = drawers.registerCanvasOverlay(({ draw }) => {
				if (!target) return;
				const button = buttonBounds(state);
				draw.startGroup(0, 0);
				draw.drawFill(button.x, button.y, PALETTE_INDICES.negativeSurface, button.width, button.height);
				draw.drawText(
					button.x + state.viewport.vGrid,
					button.y + state.viewport.hGrid,
					LABEL,
					PALETTE_INDICES.negativeOn
				);
				draw.endGroup();
			});
			events.on('pointerdown', onPointerDown, { capture: true, layer });
			events.on('pointermove', onPointerMove, { capture: true, layer });
			events.on('pointerup', release, { capture: true, layer });
			events.on('pointercancel', release, { capture: true, layer });
			events.on('loadProject', reset);
			return () => {
				removeDrawer();
				store.unsubscribe('codeErrors', refreshTarget);
				store.unsubscribe('projectChange', refreshTarget);
				store.unsubscribe('codeBlockRendering.rootProject', refreshTarget);
				events.off('pointerdown', onPointerDown);
				events.off('pointermove', onPointerMove);
				events.off('pointerup', release);
				events.off('pointercancel', release);
				events.off('loadProject', reset);
				reset();
			};
		},
	};
}
