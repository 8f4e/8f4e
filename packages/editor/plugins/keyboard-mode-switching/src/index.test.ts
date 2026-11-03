import { describe, expect, it } from 'vitest';
import { setup } from './__tests__/setup';

describe('keyboard mode switching', () => {
	it('enters with e and exits with Escape', () => {
		const test = setup();
		expect(test.key('e').defaultPrevented).toBe(true);
		expect(test.state.editorMode).toBe('edit');
		expect(test.key('Escape').defaultPrevented).toBe(true);
		expect(test.state.editorMode).toBe('view');
	});
	it.each(['ctrlKey', 'metaKey', 'altKey'])('ignores modified e (%s)', modifier => {
		const test = setup();
		expect(test.key('e', { [modifier]: true }).defaultPrevented).toBe(false);
		expect(test.state.editorMode).toBe('view');
	});
	it('honors modeToggling and removes its listener', () => {
		const test = setup();
		test.state.featureFlags.modeToggling = false;
		expect(test.key('e').defaultPrevented).toBe(false);
		test.state.featureFlags.modeToggling = true;
		test.disposePlugin();
		expect(test.key('e').defaultPrevented).toBe(false);
		expect(test.state.editorMode).toBe('view');
	});
	it('isolates editor instances', () => {
		const first = setup();
		const second = setup();
		first.key('e');
		expect(second.state.editorMode).toBe('view');
	});
});
