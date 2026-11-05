import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';
import { handleKeydown, handlePaste } from './editing';

// Test the editing implementation without its asynchronous input bridge.
const plugin = ({ inputTarget }: { inputTarget: HTMLElement }) => ({
	id: 'editing-test',
	setup: (context: Parameters<typeof handleKeydown>[1]) => {
		const onKey = (event: KeyboardEvent) => handleKeydown(event, context);
		const onPaste = (event: ClipboardEvent) => handlePaste(event, context);
		inputTarget.addEventListener('keydown', onKey);
		inputTarget.addEventListener('paste', onPaste);
		return () => {
			inputTarget.removeEventListener('keydown', onKey);
			inputTarget.removeEventListener('paste', onPaste);
		};
	},
});

describe('keyboard editing', () => {
	it('inserts text, tabs, newlines and deletes with one completed revision per change', () => {
		const test = setup(plugin);
		const before = test.state.projectChange.revision;
		const compilerBefore = test.state.compilerInputRevision;
		test.key('2');
		test.key('Tab');
		test.key('Enter');
		test.key('x');
		test.key('Backspace');
		expect(test.block.code).toEqual(['module main', 'push 12\t', '', 'drop', 'moduleEnd']);
		expect(test.block.cursor).toMatchObject({ row: 2, col: 0 });
		expect(test.state.projectChange.revision).toBe(before + 5);
		expect(test.state.compilerInputRevision).toBe(compilerBefore + 5);
	});
	it('moves the caret using visual tab columns without publishing a source change', () => {
		const test = setup(plugin);
		applyCodeBlockSourceEdits(
			test.store,
			[{ codeBlock: test.block, code: ['module main', '; @tab 8', '\tx', '123456789', 'moduleEnd'] }],
			{ affectsCompilation: true }
		);
		test.block.cursor.row = 2;
		test.block.cursor.col = 1;
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.key('ArrowDown');
		expect(test.block.cursor).toMatchObject({ row: 3, col: 8 });
		test.key('ArrowLeft');
		expect(test.block.cursor.col).toBe(7);
		test.key('ArrowUp');
		expect(test.block.cursor).toMatchObject({ row: 2, col: 1 });
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});
	it('keeps horizontal movement within the line bounds', () => {
		const test = setup(plugin);
		test.key('ArrowRight');
		expect(test.block.cursor.col).toBe(6);
		test.key('ArrowLeft');
		expect(test.block.cursor.col).toBe(5);
		test.block.cursor.col = 0;
		test.key('ArrowLeft');
		expect(test.block.cursor.col).toBe(0);
	});
	it('keeps vertical movement within the block bounds', () => {
		const test = setup(plugin);
		test.block.cursor.row = 0;
		test.block.cursor.col = 0;
		test.key('ArrowUp');
		expect(test.block.cursor).toMatchObject({ row: 0, col: 0 });
		test.block.cursor.row = test.block.code.length - 1;
		test.key('ArrowDown');
		expect(test.block.cursor.row).toBe(test.block.code.length - 1);
	});
	it('honors codeLineSelection for caret movement', () => {
		const test = setup(plugin);
		test.state.featureFlags.codeLineSelection = false;
		expect(test.key('ArrowDown').defaultPrevented).toBe(false);
		expect(test.block.cursor.row).toBe(1);
	});
	it('ignores backspace at the start of a block', () => {
		const test = setup(plugin);
		test.block.cursor.row = 0;
		test.block.cursor.col = 0;
		const revision = test.state.projectChange.revision;
		test.key('Backspace');
		expect(test.state.projectChange.revision).toBe(revision);
	});
	it.each(['ctrlKey', 'metaKey'])('undoes pending typing and redoes it using %s', modifier => {
		const test = setup(plugin);
		test.key('2');
		test.key('z', { [modifier]: true });
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'main')!.code).toContain(
			'push 1'
		);
		test.key('z', { [modifier]: true, shiftKey: true });
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'main')!.code).toContain(
			'push 12'
		);
		test.key('z', { [modifier]: true });
		test.key('y', { [modifier]: true });
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'main')!.code).toContain(
			'push 12'
		);
	});
	it('does not handle typing or history shortcuts in view mode', () => {
		const test = setup(plugin, 'view');
		const undo = vi.fn();
		test.events.on('undo', undo);
		for (const key of ['2', 'Backspace', 'Enter', 'Tab', 'ArrowUp', 'ArrowRight'])
			expect(test.key(key).defaultPrevented).toBe(false);
		expect(test.key('z', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(test.key('y', { metaKey: true }).defaultPrevented).toBe(false);
		expect(undo).not.toHaveBeenCalled();
	});
	it('leaves block navigation, mode switching, and other shortcuts to their owners', () => {
		const test = setup(plugin);
		for (const key of ['Escape', 'Dead']) expect(test.key(key).defaultPrevented).toBe(false);
		expect(test.key('ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(test.key('s', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(test.key('a', { altKey: true }).defaultPrevented).toBe(false);
	});
});

describe('text pasting', () => {
	it('inserts multiline plain text once and leaves the caret at the end of the insertion', () => {
		const test = setup(plugin);
		const revision = test.state.projectChange.revision;
		const compiler = test.state.compilerInputRevision;
		test.block.cursor = { row: 1, col: 5, y: 0 };
		expect(test.paste('2\r\n\tpush 3').defaultPrevented).toBe(true);
		expect(test.block.code).toEqual(['module main', 'push 2', '\tpush 31', 'drop', 'moduleEnd']);
		expect(test.block.cursor).toMatchObject({ row: 2, col: 7 });
		expect(test.state.projectChange.revision).toBe(revision + 1);
		expect(test.state.compilerInputRevision).toBe(compiler + 1);
	});
	it('keeps block-looking text inside the edited block and supports undo/redo', () => {
		const test = setup(plugin);
		const original = [...test.block.code];
		test.paste('module pasted\nmoduleEnd');
		expect(
			test.state.codeBlockRendering.currentProject.blocks.filter(block => block.blockType === 'module')
		).toHaveLength(1);
		const updated = [...test.block.code];
		test.events.dispatch('undo');
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'main')!.code).toEqual(
			original
		);
		test.events.dispatch('redo');
		expect(test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'main')!.code).toEqual(
			updated
		);
	});
	it.each(['view mode', 'no selected block', 'empty text'])('leaves paste unhandled with %s', reason => {
		const test = setup(plugin);
		const original = [...test.block.code];
		if (reason === 'view mode') test.store.set('editorMode', 'view');
		if (reason === 'no selected block') test.store.set('codeBlockRendering.selectedCodeBlock', undefined);
		const event = test.paste(reason === 'empty text' ? '' : 'text');
		expect(event.defaultPrevented).toBe(false);
		expect(test.block.code).toEqual(original);
	});
});
