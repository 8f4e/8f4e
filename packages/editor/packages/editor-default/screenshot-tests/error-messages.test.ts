import { getEditorBlockId } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { getErrorMessageBounds } from '@8f4e/editor-plugin-error-messages';
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
		// Exercise the composition's injected bounds reader with real runtime diagnostics and mouse input.
		for (const id of ['jump-to-error', 'mouse-input']) {
			await expect
				.poll(() => editor.state.loadingIndicators.find(item => item.id === `plugin:${id}`)?.status)
				.toBe('done');
		}
		editor.state.viewport.x = 1000;
		editor.state.viewport.y = 1000;
		await userEvent.click(canvas, { position: { x: 620, y: 344 } });
		const bounds = getErrorMessageBounds(editor.state, block())[0];
		expect(editor.state.codeBlockRendering.selectedCodeBlock).toBe(block());
		expect(editor.state.viewport.x).toBe(Math.round(bounds.x + bounds.width / 2 - 320));
		expect(editor.state.viewport.y).toBe(Math.round(bounds.y + bounds.height / 2 - 192));

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
