import initEditor, { type Editor } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup() {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 384;
	document.body.append(canvas);
	let editor: Editor;
	const plugins = createDefaultEditorPlugins({
		canvas,
		storage: { getItem: () => null, setItem: () => {} } as Storage,
		storageKey: 'clipboard-test',
		showOpenMenuItem: false,
		includeKeyboardModeSwitching: false,
		renderFrame: () => editor.renderFrame(),
		getMemory: () => null,
		getCodeBuffer: () => new Uint8Array(),
		getAssertionSites: () => undefined,
		writeMemory: () => {},
	});
	editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 120 60', 'constantsEnd'] }],
			notes: [{ id: 1, code: ['note target', '; @mode edit', '; @pos 4 3', '', 'noteEnd'] }],
			execution: [
				{ type: 'module', id: 2, entry: 'main', code: ['module same', '; @pos 40 3', '; @group audio', 'moduleEnd'] },
			],
		},
		plugins,
	});
	editor.pauseRendering();
	cleanups.push(() => {
		editor.dispose();
		canvas.remove();
	});
	return { canvas, editor, state: editor.state };
}

test('Ctrl/Cmd+V pastes plain text into the selected block through native clipboard input', async () => {
	const { canvas, editor, state } = await setup();
	const target = () => state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
	await expect
		.poll(async () => {
			const block = target();
			await userEvent.click(canvas, {
				position: { x: block.x - state.viewport.x + 40, y: block.y - state.viewport.y + 3 * state.viewport.hGrid + 8 },
			});
			return state.codeBlockRendering.selectedCodeBlock?.name;
		})
		.toBe('target');
	const block = target();
	const { row, col } = block.cursor;
	const beforeTyping = block.code[row];
	await userEvent.keyboard('>');
	await expect.poll(() => target().code[row]).toBe(beforeTyping.slice(0, col) + '>' + beforeTyping.slice(col));
	const beforePaste = target().code[row];
	const pasteCol = target().cursor.col;
	const text = 'Text pasted at the caret';
	await navigator.clipboard.writeText(text);
	const modifier = navigator.platform.startsWith('Mac') ? 'Meta' : 'Control';
	await userEvent.keyboard(`{${modifier}>}v{/${modifier}}`);
	await expect.poll(() => target().code[row]).toBe(beforePaste.slice(0, pasteCol) + text + beforePaste.slice(pasteCol));
	expect(state.codeBlockRendering.currentProject.blocks.filter(block => block.blockType === 'note')).toHaveLength(1);
	editor.renderFrame();
	await expect(canvas).toMatchScreenshot('text-pasted');
});

test('the block paste menu changes placement while preserving duplicate names, groups and references', async () => {
	const { canvas, state } = await setup();
	const source = ['module same', '; @pos 1 2', '; @group audio', 'push &same:value', 'moduleEnd'];
	await navigator.clipboard.writeText(source.join('\n'));
	await expect
		.poll(async () => {
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: rect.left + 600, clientY: rect.top + 300 }));
			await Promise.resolve();
			return state.contextMenu.items.some(item => item.action === 'pasteCodeBlocks');
		})
		.toBe(true);
	const menu = state.contextMenu;
	const index = menu.items.findIndex(item => item.action === 'pasteCodeBlocks');
	const pastePosition = {
		x: menu.x - state.viewport.x + 8,
		y: menu.y - state.viewport.y + index * state.viewport.hGrid + 8,
	};
	const pos = `; @pos ${Math.round((state.viewport.x + pastePosition.x) / state.viewport.vGrid)} ${Math.round((state.viewport.y + pastePosition.y) / state.viewport.hGrid)}`;
	await userEvent.click(canvas, { position: pastePosition });
	const sameNamed = () => state.codeBlockRendering.currentProject.blocks.filter(block => block.name === 'same');
	await expect.poll(() => sameNamed().length).toBe(2);
	expect(sameNamed()[1].code).toEqual(['module same', pos, '; @group audio', 'push &same:value', 'moduleEnd']);
});
