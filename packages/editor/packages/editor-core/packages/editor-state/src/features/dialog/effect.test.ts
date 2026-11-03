import type { DialogContent, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import dialog from './effect';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});
const content: DialogContent = {
	id: 'confirmation',
	title: 'Confirm',
	text: 'Continue?',
	buttons: [{ title: 'Cancel' }, { title: 'Allow', action: 'confirmAction', payload: { id: 42 } }],
};

function setup(state: State = createMockState()) {
	const store = createStateManager(state);
	const events = createMockEventDispatcherWithVitest();
	const dispose = dialog(store, events);
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	const emit = <T>(name: string, event?: T) => {
		const callback = vi.mocked(events.on).mock.calls.find(call => call[0] === name)?.[1];
		if (!callback) throw new Error(`Missing listener: ${name}`);
		callback(event);
	};
	return { state, store, events, emit, dispose };
}

describe('dialog lifecycle', () => {
	it('keeps content available without a presentation plugin and restores the previous dialog', () => {
		const { state, emit } = setup();
		emit('addDialog', content);
		expect(state.dialog).toEqual(content);
		emit('addDialog', { ...content, id: 'second', title: 'Second' });
		expect(state.dialog.id).toBe('second');
		emit('removeDialog', { id: 'second' });
		expect(state.dialog).toEqual(content);
		emit('removeDialog', content.id);
		expect(state.dialogStack).toEqual([]);
		expect(state.dialog).toEqual({ id: '', title: '', text: '', buttons: [] });
	});

	it('replaces an existing ID at the top of the stack and clears all dialogs', () => {
		const { state, emit } = setup(createMockState({ dialogStack: [content] }));
		expect(state.dialog).toEqual(content);
		emit('addDialog', { ...content, id: 'other' });
		emit('addDialog', { ...content, title: 'Updated' });
		expect(state.dialogStack.map(dialog => dialog.id)).toEqual(['other', content.id]);
		expect(state.dialog.title).toBe('Updated');
		emit('clearDialogs');
		expect(state.dialogStack).toEqual([]);
		expect(state.dialog.id).toBe('');
	});

	it('closes the top dialog before dispatching its button action and payload', () => {
		const { state, emit, events } = setup(createMockState({ dialogStack: [content] }));
		emit('activateDialogButton', { id: content.id, buttonIndex: 1 });
		expect(state.dialogStack).toEqual([]);
		expect(events.dispatch).toHaveBeenCalledWith('confirmAction', { id: 42 });
	});

	it('keeps a dialog open when the activated button opts out of closing', () => {
		const keepOpen = { ...content, buttons: [{ title: 'Retry', action: 'retryAction', close: false }] };
		const { state, emit, events } = setup(createMockState({ dialogStack: [keepOpen] }));
		emit('activateDialogButton', { id: content.id, buttonIndex: 0 });
		expect(state.dialogStack).toEqual([keepOpen]);
		expect(events.dispatch).toHaveBeenCalledWith('retryAction', undefined);
	});

	it('closes buttons without actions', () => {
		const { state, emit, events } = setup(createMockState({ dialogStack: [content] }));
		emit('activateDialogButton', { id: content.id, buttonIndex: 0 });
		expect(state.dialogStack).toEqual([]);
		expect(events.dispatch).not.toHaveBeenCalled();
	});

	it.each(['pointerdown', 'pointermove', 'pointerup', 'contextmenu'])(
		'blocks %s even without a presentation plugin',
		name => {
			const { state, emit, events } = setup(createMockState({ dialogStack: [content] }));
			const event = { x: 0, y: 0, stopPropagation: false } as InternalPointerEvent;
			emit(name, event);
			expect(event.stopPropagation).toBe(true);
			expect(state.dialogStack).toHaveLength(1);
			if (name === 'pointerdown') expect(events.dispatch).toHaveBeenCalledWith('dialogPointerDown', event);
			else expect(events.dispatch).not.toHaveBeenCalled();
		}
	);

	it('leaves pointer input alone when the stack is empty and removes its listeners on disposal', () => {
		const { emit, events, dispose } = setup();
		const event = { stopPropagation: false };
		emit('pointerdown', event);
		expect(event.stopPropagation).toBe(false);
		expect(events.dispatch).not.toHaveBeenCalled();
		dispose();
		for (const [name, handler] of vi.mocked(events.on).mock.calls)
			expect(events.off).toHaveBeenCalledWith(name, handler);
	});
});
