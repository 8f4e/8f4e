import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';
import { handleKeydown } from './editing';

// Test the editing implementation without its asynchronous input bridge.
const plugin = ({ inputTarget }: { inputTarget: HTMLElement }) => ({
	id: 'editing-test',
	setup: (context: Parameters<typeof handleKeydown>[1]) => {
		const onKey = (event: KeyboardEvent) => handleKeydown(event, context);
		inputTarget.addEventListener('keydown', onKey);
		return () => inputTarget.removeEventListener('keydown', onKey);
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
		for (const key of ['2', 'Backspace', 'Enter', 'Tab']) expect(test.key(key).defaultPrevented).toBe(false);
		expect(test.key('z', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(test.key('y', { metaKey: true }).defaultPrevented).toBe(false);
		expect(undo).not.toHaveBeenCalled();
	});
	it('leaves navigation, mode switching, and other shortcuts to their owners', () => {
		const test = setup(plugin);
		for (const key of ['ArrowDown', 'Escape', 'Dead']) expect(test.key(key).defaultPrevented).toBe(false);
		expect(test.key('s', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(test.key('a', { altKey: true }).defaultPrevented).toBe(false);
	});
});
