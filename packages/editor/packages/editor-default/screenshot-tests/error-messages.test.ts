import { getEditorBlockId } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { gapCalculator } from '@8f4e/editor-state';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

test('shows assertion failures through shared errors and clears their layout after a successful edit', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	const source = `8f4e/v1
constants env
; @pos 150 100
constantsEnd
note settings
; @pos 150 100
; @mode edit
; @config testRuntime.enabled true
noteEnd
entry test
module checks
; @pos 4 3
push 0
assert
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
		const block = () => editor.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'checks')!;
		await expect.poll(() => editor.state.info.testRuntime?.status, { timeout: 10000 }).toBe('failed');
		expect(editor.state.codeErrors['test-runtime'][0]).toMatchObject({
			codeBlockId: block().creationIndex,
			lineNumber: 3,
			message: 'Assertion failed: expected nonzero, received 0',
		});
		await expect.poll(() => block().gaps.get(3)?.size).toBeGreaterThan(0);
		editor.state.viewport.x = 0;
		editor.state.viewport.y = 0;
		// Let completed startup indicators hide before capturing the assertion layout.
		await expect
			.poll(
				() =>
					editor.state.loadingIndicators.every(
						indicator =>
							indicator.finishedAt !== null &&
							Date.now() - indicator.finishedAt >
								(indicator.status === 'done' ? 3000 : 5000) + 25 * editor.state.loadingIndicators.length
					),
				{ timeout: 10000 }
			)
			.toBe(true);
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('assertion-error');
		// Navigate to a real runtime diagnostic through mouse input.
		for (const id of ['jump-to-error', 'mouse-input']) {
			await expect
				.poll(() => editor.state.loadingIndicators.find(item => item.id === `plugin:${id}`)?.status)
				.toBe('done');
		}
		editor.state.viewport.x = 1000;
		editor.state.viewport.y = 1000;
		await userEvent.click(canvas, { position: { x: 620, y: 344 } });
		const row =
			block().displayModel.sourceLineIndexToDisplayRow[editor.state.codeErrors['test-runtime'][0].lineNumber]!;
		expect(editor.state.codeBlockRendering.selectedCodeBlock).toBe(block());
		expect(editor.state.viewport.x).toBe(Math.round(block().x + block().width / 2 - 320));
		expect(editor.state.viewport.y).toBe(
			Math.round(block().y + (gapCalculator(row, block().gaps) + 0.5) * editor.state.viewport.hGrid - 192)
		);

		// Sample a solid part of the jump button: menu labels may arrive in different lazy-plugin orders.
		const gl = canvas.getContext('webgl2')!;
		const readButtonPixel = () => {
			const pixel = new Uint8Array(4);
			gl.readPixels(516, canvas.height - 1 - 328, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			return [...pixel];
		};
		editor.renderFrame();
		const buttonPixel = readButtonPixel();
		// A context menu is drawn and hit-tested above the floating jump button.
		await userEvent.click(canvas, { button: 'right', position: { x: 620, y: 344 } });
		await expect.poll(() => editor.state.contextMenu.open && editor.state.contextMenu.items.length > 0).toBe(true);
		editor.renderFrame();
		expect(readButtonPixel()).not.toEqual(buttonPixel);
		const menuViewport = { x: editor.state.viewport.x, y: editor.state.viewport.y };
		await userEvent.click(canvas, { position: { x: 8, y: 8 } });
		expect(editor.state.contextMenu.open).toBe(false);
		expect(editor.state.viewport).toMatchObject(menuViewport);

		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(block()),
					code: block().code.map(line => (line === 'push 0' ? 'push 1' : line)),
				},
			],
		});
		await expect.poll(() => editor.state.info.testRuntime?.status, { timeout: 10000 }).toBe('passed');
		expect(editor.state.codeErrors['test-runtime']).toEqual([]);
		expect(block().gaps.size).toBe(0);
		expect(block().height).toBe(block().displayModel.lines.length * editor.state.viewport.hGrid);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
