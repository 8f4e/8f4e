import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator, getCodeBlockErrors } from '@8f4e/editor-state';
import type { InternalPointerEvent } from '@8f4e/editor-state-types';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { expect, test, vi } from 'vitest';
import { createJumpToErrorPlugin } from '../src/index';

// Plain source rows keep the suite independent of presentation plugins.
async function setup(source: string) {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let context!: EditorPluginContext;

	const blockPressed = vi.fn();
	const editor = await initEditor(canvas, {
		initialProject: parseProjectSource(source),
		plugins: [
			{
				id: 'test-fixture',
				setup: services => {
					context = services;
					services.events.on('codeBlockPointerDown', blockPressed, { capture: true });
					const removeDrawer = services.drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
						const errors = getCodeBlockErrors(state, codeBlock);
						if (!errors.length) return;
						draw.drawFill(0, 0, PALETTE_INDICES.surfaceBase, codeBlock.width, codeBlock.height);
						codeBlock.displayModel.lines.forEach((line, row) => {
							const y = gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid;
							const isError = errors.some(error => error.lineNumber === line.sourceLineIndex);
							if (isError) draw.drawFill(0, y, PALETTE_INDICES.negativeSurface, codeBlock.width, state.viewport.hGrid);
							draw.drawText(
								state.viewport.vGrid,
								y,
								line.text,
								isError ? PALETTE_INDICES.negativeOn : PALETTE_INDICES.inkBase
							);
						});
					});
					return () => {
						removeDrawer();
						services.events.off('codeBlockPointerDown', blockPressed);
					};
				},
			},
			createJumpToErrorPlugin({ layer: INPUT_LAYERS.canvasOverlay }),
		],
	});
	editor.pauseRendering();
	const state = editor.state;
	const pointer = () =>
		({
			x: 620,
			y: 344,
			buttons: 1,
			stopPropagation: false,
			movementX: 0,
			movementY: 0,
			canvasWidth: 640,
			canvasHeight: 384,
			altKey: false,
		}) satisfies InternalPointerEvent;
	const press = (phase?: 'capture') => {
		const event = pointer();
		context.events.dispatch('pointerdown', event, { phase });
		context.events.dispatch('pointerup', { ...pointer(), buttons: 0 }, { phase });
		return event;
	};
	const dispose = () => {
		editor.dispose();
		canvas.remove();
	};
	return { canvas, editor, context, state, press, dispose, blockPressed };
}

test('centers the source line independently of error presentation and hides after errors clear', async () => {
	const fixture = await setup(`8f4e/v1
entry main
module problem
; @pos 60 20
push 1
drop
moduleEnd
entryEnd`);
	const { state, context, editor, canvas } = fixture;
	try {
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'problem')!;
		const error = { codeBlockId: block.creationIndex, lineNumber: 2, message: 'Fixture error' };
		context.store.set('codeErrors.fixture', [error]);
		const revision = editor.editing.getRevision();
		const compilerRevision = state.compilerInputRevision;
		expect(fixture.press().stopPropagation).toBe(true);
		expect(fixture.blockPressed).not.toHaveBeenCalled();
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(state.viewport.x).toBe(block.x + block.width / 2 - 320);
		expect(state.viewport.y).toBe(block.y + (error.lineNumber + 0.5) * state.viewport.hGrid - 192);
		expect(editor.editing.getRevision()).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('jump-to-error-target');
		context.store.set('codeErrors.fixture', []);
		expect(fixture.press().stopPropagation).toBe(false);
	} finally {
		fixture.dispose();
	}
});

test.each([undefined, 'capture'] as const)('reveals folded nested errors through the %s pointer phase', async phase => {
	const fixture = await setup(`8f4e/v1
entry main
group audio
entry main
module folded
; @pos 140 120
; @hide
push 1
drop
moduleEnd
entryEnd
groupEnd
entryEnd`);
	try {
		const { state, context, editor } = fixture;
		const group = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'audio')!;
		const block = group.childProject!.blocks.find(block => block.name === 'folded')!;
		context.events.dispatch('openProjectGroup', { codeBlock: group });
		context.events.dispatch('goToRootProjectGroup');
		const error = { codeBlockId: block.creationIndex, lineNumber: 3, message: 'Folded fixture error' };
		context.store.set('codeErrors.fixture', [error]);
		expect(block.isCollapsed).toBe(true);
		const revision = editor.editing.getRevision();
		expect(fixture.press(phase).stopPropagation).toBe(true);
		expect(state.codeBlockRendering.currentProject.path).toBe('audio');
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(block.isCollapsed).toBe(false);
		expect(state.editorMode).toBe('view');
		expect(state.viewport.x).toBe(block.x + block.width / 2 - 320);
		expect(state.viewport.y).toBe(block.y + (error.lineNumber + 0.5) * state.viewport.hGrid - 192);
		expect(editor.editing.getRevision()).toBe(revision);
	} finally {
		fixture.dispose();
	}
});

test('a later overlay can consume a press before the jump button', async () => {
	const fixture = await setup(`8f4e/v1
entry main
module target
; @pos 60 20
push 1
moduleEnd
entryEnd`);
	try {
		const { state, context } = fixture;
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
		context.store.set('codeErrors.fixture', [{ codeBlockId: block.creationIndex, lineNumber: 2, message: 'Fixture' }]);
		const previous = { x: state.viewport.x, y: state.viewport.y };
		const intercept = (event: InternalPointerEvent) => {
			event.stopPropagation = true;
		};
		context.events.on('pointerdown', intercept, { capture: true, layer: INPUT_LAYERS.canvasOverlay });
		fixture.press();
		expect(state.viewport).toMatchObject(previous);
		context.events.off('pointerdown', intercept);
		fixture.press();
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
	} finally {
		fixture.dispose();
	}
});
