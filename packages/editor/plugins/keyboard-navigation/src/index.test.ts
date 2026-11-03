import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';
import { createKeyboardNavigationPlugin } from './index';

describe('keyboard navigation', () => {
	it('selects lines in view mode while leaving horizontal arrows unhandled', () => {
		const test = setup(createKeyboardNavigationPlugin, 'view');
		const revision = test.state.projectChange.revision;
		expect(test.key('ArrowDown').defaultPrevented).toBe(true);
		expect(test.block.cursor.row).toBe(2);
		expect(test.key('ArrowLeft').defaultPrevented).toBe(false);
		expect(test.block.cursor.col).toBe(4);
		expect(test.state.projectChange.revision).toBe(revision);
	});
	it('moves the caret while editing and honors visual tab columns', () => {
		const test = setup(createKeyboardNavigationPlugin);
		applyCodeBlockSourceEdits(
			test.store,
			[{ codeBlock: test.block, code: ['module main', '; @tab 8', '\tx', '123456789', 'moduleEnd'] }],
			{ affectsCompilation: true }
		);
		test.block.cursor.row = 2;
		test.block.cursor.col = 1;
		test.key('ArrowDown');
		expect(test.block.cursor).toMatchObject({ row: 3, col: 8 });
		test.key('ArrowLeft');
		expect(test.block.cursor.col).toBe(7);
		test.key('ArrowUp');
		expect(test.block.cursor).toMatchObject({ row: 2, col: 1 });
	});
	it.each(['ctrlKey', 'metaKey'])('dispatches block navigation with %s', modifier => {
		const test = setup(createKeyboardNavigationPlugin, 'view');
		const navigate = vi.fn();
		test.events.on('navigateCodeBlock', navigate);
		expect(test.key('ArrowRight', { [modifier]: true }).defaultPrevented).toBe(true);
		expect(navigate).toHaveBeenCalledWith({ direction: 'right' });
	});
	it('honors codeLineSelection and removes its listener', () => {
		const test = setup(createKeyboardNavigationPlugin);
		test.state.featureFlags.codeLineSelection = false;
		expect(test.key('ArrowDown').defaultPrevented).toBe(false);
		test.state.featureFlags.codeLineSelection = true;
		test.disposePlugin();
		expect(test.key('ArrowDown').defaultPrevented).toBe(false);
		expect(test.block.cursor.row).toBe(1);
	});
	it('leaves text editing and undo unhandled', () => {
		const test = setup(createKeyboardNavigationPlugin);
		for (const key of ['a', 'Backspace', 'Enter', 'Tab']) expect(test.key(key).defaultPrevented).toBe(false);
		expect(test.key('z', { ctrlKey: true }).defaultPrevented).toBe(false);
	});
});
