import { getEditorBlockId } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { getErrorMessageBounds } from '@8f4e/editor-plugin-error-messages';
import type {} from '@vitest/browser-playwright';
import { expect, test } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

test('jumps to the center of a real compiler error and removes the button after fixing it', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	canvas.style.width = '640px';
	canvas.style.height = '384px';
	document.body.append(canvas);
	const source = `8f4e/v1
constants env
; @pos 150 100
constantsEnd
note settings
; @pos 150 100
; @mode edit
noteEnd
entry main
module problem
; @pos 140 120
push missing
drop
moduleEnd
entryEnd`;
	const editor = await mountDefaultEditor(canvas, {
		initialProjectUrl: `data:text/plain,${encodeURIComponent(source)}`,
		storage: { getItem: () => null, setItem: () => {} } as unknown as Storage,
		includeKeyboardModeSwitching: false,
		showOpenMenuItem: false,
	});
	editor.pauseRendering();
	try {
		const state = editor.state;
		const block = () => state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'problem')!;
		await expect.poll(() => state.codeErrors.compiler?.length, { timeout: 10000 }).toBe(1);
		await expect.poll(() => block().gaps.get(2)?.size).toBeGreaterThan(0);
		for (const id of ['jump-to-error', 'mouse-input']) {
			await expect.poll(() => state.loadingIndicators.find(item => item.id === `plugin:${id}`)?.status).toBe('done');
		}
		state.viewport.x = 0;
		state.viewport.y = 0;
		editor.renderFrame();
		const revision = editor.editing.getRevision();
		const compilerRevision = state.compilerInputRevision;
		await userEvent.click(canvas, { position: { x: 620, y: 344 } });
		const bounds = getErrorMessageBounds(state, block())[0];
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block());
		expect(Math.abs(bounds.x + bounds.width / 2 - state.viewport.x - 320)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(bounds.y + bounds.height / 2 - state.viewport.y - 192)).toBeLessThanOrEqual(0.5);
		expect(editor.editing.getRevision()).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
		// Let startup indicators finish their display interval before capturing the button and message.
		await expect
			.poll(
				() =>
					state.loadingIndicators.every(
						item =>
							item.finishedAt !== null &&
							Date.now() - item.finishedAt >
								(item.status === 'done' ? 3100 : 5100) + 25 * state.loadingIndicators.length
					),
				{ timeout: 10000 }
			)
			.toBe(true);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('jump-to-compiler-error');
		editor.editing.applyEdits({
			expectedRevision: revision,
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block()),
					code: block().code.map(line => (line === 'push missing' ? 'push 1' : line)),
				},
			],
		});
		await expect.poll(() => state.codeErrors.compiler, { timeout: 10000 }).toEqual([]);
		editor.renderFrame();
		await userEvent.click(canvas, { position: { x: 620, y: 344 } });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
	} finally {
		editor.dispose();
		canvas.remove();
	}
});

test.each(['mouse', 'touch'] as const)('reveals folded errors inside a nested group with %s input', async inputMode => {
	const input = cdp();
	if (inputMode === 'touch')
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let editor: Awaited<ReturnType<typeof mountDefaultEditor>> | undefined;
	try {
		const source = `8f4e/v1
constants env
; @pos 150 100
constantsEnd
entry main
group audio
entry main
module folded
; @pos 140 120
; @hide
push missing
drop
moduleEnd
entryEnd
groupEnd
entryEnd`;
		editor = await mountDefaultEditor(canvas, {
			initialProjectUrl: `data:text/plain,${encodeURIComponent(source)}`,
			storage: { getItem: () => null, setItem: () => {} } as unknown as Storage,
			includeKeyboardModeSwitching: false,
		});
		editor.pauseRendering();
		const state = editor.state;
		await expect.poll(() => state.codeErrors.compiler?.length, { timeout: 10000 }).toBe(1);
		for (const id of ['error-messages', 'jump-to-error', inputMode === 'touch' ? 'touch-input' : 'mouse-input']) {
			await expect.poll(() => state.loadingIndicators.find(item => item.id === `plugin:${id}`)?.status).toBe('done');
		}
		expect(state.editorMode).toBe('view');
		const revision = editor.editing.getRevision();
		if (inputMode === 'mouse') {
			await userEvent.click(canvas, { position: { x: 620, y: 344 } });
		} else {
			const rect = canvas.getBoundingClientRect();
			const frame = window.frameElement!.getBoundingClientRect();
			await input.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [{ x: frame.left + rect.left + 620, y: frame.top + rect.top + 344, id: 1 }],
			});
			await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		}
		expect(state.codeBlockRendering.currentProject.path).toBe('audio');
		expect(state.editorMode).toBe('view');
		const block = state.codeBlockRendering.selectedCodeBlock!;
		expect(block.name).toBe('folded');
		expect(block.isCollapsed).toBe(false);
		const bounds = getErrorMessageBounds(state, block)[0];
		expect(Math.abs(bounds.x + bounds.width / 2 - state.viewport.x - 320)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(bounds.y + bounds.height / 2 - state.viewport.y - 192)).toBeLessThanOrEqual(0.5);
		expect(editor.editing.getRevision()).toBe(revision);
	} finally {
		editor?.dispose();
		canvas.remove();
		if (inputMode === 'touch') await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});
