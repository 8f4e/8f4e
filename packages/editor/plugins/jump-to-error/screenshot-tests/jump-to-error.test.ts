import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { getCodeBlockErrors } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeError, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { expect, test, vi } from 'vitest';
import { createJumpToErrorPlugin } from '../src/index';

// A supplied presentation rectangle; this suite does not install another feature plugin.
const target = { x: 16, y: 160, width: 128, height: 64 };
async function setup(source: string) {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const getErrorBounds = (_state: State, codeBlock: CodeBlockGraphicData, error: CodeError) => {
		if (codeBlock.displayModel.sourceLineIndexToDisplayRow[error.lineNumber] === undefined) return;
		return { ...target, x: codeBlock.x + target.x, y: codeBlock.y + target.y };
	};
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
						if (!getCodeBlockErrors(state, codeBlock).some(error => getErrorBounds(state, codeBlock, error))) return;
						draw.drawFill(target.x, target.y, PALETTE_INDICES.negativeSurface, target.width, target.height);
						draw.drawText(target.x + 8, target.y + 16, 'Error target', PALETTE_INDICES.negativeOn);
					});
					return () => {
						removeDrawer();
						services.events.off('codeBlockPointerDown', blockPressed);
					};
				},
			},
			createJumpToErrorPlugin({ getErrorBounds, layer: INPUT_LAYERS.canvasOverlay }),
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
	return { canvas, editor, context, state, press, dispose, getErrorBounds, blockPressed };
}

test('centers supplied error bounds and removes the button when errors clear', async () => {
	const fixture = await setup(`8f4e/v1
entry main
module problem
; @pos 60 20
push 1
drop
moduleEnd
entryEnd`);
	const { state, context, editor, canvas, getErrorBounds } = fixture;
	try {
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'problem')!;
		const error = { codeBlockId: block.creationIndex, lineNumber: 2, message: 'Fixture error' };
		context.store.set('codeErrors.fixture', [error]);
		const revision = editor.editing.getRevision();
		const compilerRevision = state.compilerInputRevision;
		expect(fixture.press().stopPropagation).toBe(true);
		expect(fixture.blockPressed).not.toHaveBeenCalled();
		const bounds = getErrorBounds(state, block, error)!;
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(state.viewport.x).toBe(bounds.x + bounds.width / 2 - 320);
		expect(state.viewport.y).toBe(bounds.y + bounds.height / 2 - 192);
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
		const bounds = fixture.getErrorBounds(state, block, error)!;
		expect(state.viewport.x).toBe(bounds.x + bounds.width / 2 - 320);
		expect(state.viewport.y).toBe(bounds.y + bounds.height / 2 - 192);
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
