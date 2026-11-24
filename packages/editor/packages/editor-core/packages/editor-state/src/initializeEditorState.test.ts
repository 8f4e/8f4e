import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import initializeEditorState from './index';

it('removes its event listeners on disposal without removing listeners owned by the caller', () => {
	const emitter = new EventEmitter();
	const events = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	const onNavigate = vi.fn();
	emitter.on('navigateCodeBlock', onNavigate);
	const store = initializeEditorState(events, { callbacks: {} });
	try {
		expect(emitter.listenerCount('enterEditMode')).toBe(1);
		expect(emitter.listenerCount('exitToViewMode')).toBe(1);
		expect(emitter.listenerCount('navigateCodeBlock')).toBe(2);
	} finally {
		store.dispose();
	}

	expect(emitter.eventNames()).toEqual(['navigateCodeBlock']);
	expect(emitter.listeners('navigateCodeBlock')).toEqual([onNavigate]);
});
