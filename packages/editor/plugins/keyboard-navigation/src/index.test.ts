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
	it('leaves edit-mode caret movement to the editing plugin', () => {
		const test = setup(createKeyboardNavigationPlugin, 'edit');
		for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
			expect(test.key(key).defaultPrevented).toBe(false);
		expect(test.block.cursor).toMatchObject({ row: 1, col: 6 });
	});
	it.each([
		['view', 'ctrlKey'],
		['view', 'metaKey'],
		['edit', 'ctrlKey'],
		['edit', 'metaKey'],
	] as const)('dispatches block navigation in %s mode with %s', (mode, modifier) => {
		const test = setup(createKeyboardNavigationPlugin, mode);
		const navigate = vi.fn();
		test.events.on('navigateCodeBlock', navigate);
		expect(test.key('ArrowRight', { [modifier]: true }).defaultPrevented).toBe(true);
		expect(navigate).toHaveBeenCalledWith({ direction: 'right' });
	});
	it('honors codeLineSelection and removes its listener', () => {
		const test = setup(createKeyboardNavigationPlugin, 'view');
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
