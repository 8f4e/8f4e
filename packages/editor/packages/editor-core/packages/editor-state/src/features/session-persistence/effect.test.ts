import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import sessionPersistence from './effect';

describe('session persistence', () => {
	it('saves the root project and updates storage quota', async () => {
		const saveSession = vi.fn().mockResolvedValue(undefined);
		const getStorageQuota = vi.fn().mockResolvedValue({ usedBytes: 1024, totalBytes: 10240 });
		const state = createMockState({ callbacks: { saveSession, getStorageQuota } });
		state.codeBlockRendering.rootCodeBlocks.push(
			createMockCodeBlock({ blockType: 'module', code: ['module other', 'moduleEnd'], entry: 'main' })
		);
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		const dispose = sessionPersistence(store, events);
		await vi
			.mocked(events.on)
			.mock.calls.find(([name]) => name === 'saveSession')![1](undefined);
		expect(saveSession.mock.calls[0][0].modules).toEqual([
			{ id: 0, code: ['module other', 'moduleEnd'], entry: 'main' },
		]);
		expect(state.storageQuota).toEqual({ usedBytes: 1024, totalBytes: 10240 });
		dispose();
		store.dispose();
	});
	it('saves named notes and their edits and deletion automatically', () => {
		const saveSession = vi.fn().mockResolvedValue(undefined);
		const state = createMockState({ callbacks: { saveSession } });
		const note = createMockCodeBlock({ blockType: 'note', code: ['note local.settings', 'noteEnd'] });
		state.codeBlockRendering.rootCodeBlocks.push(note);
		state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = note;
		const store = createStateManager(state);
		const dispose = sessionPersistence(store, createMockEventDispatcherWithVitest());
		const code = ['note local.settings', '; @pos 4 8', 'noteEnd'];
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', code);
		expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ notes: [{ id: 0, code }] }));
		state.codeBlockRendering.rootCodeBlocks.splice(0);
		store.set('codeBlockRendering.codeBlocks', state.codeBlockRendering.rootCodeBlocks);
		expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ notes: [] }));
		dispose();
		store.dispose();
	});
	it('does nothing when session saving is unavailable', async () => {
		const store = createStateManager(createMockState());
		const events = createMockEventDispatcherWithVitest();
		const dispose = sessionPersistence(store, events);
		await expect(vi.mocked(events.on).mock.calls[0][1](undefined)).resolves.toBeUndefined();
		dispose();
		store.dispose();
	});
	it('releases code subscriptions and its event listener', () => {
		const saveSession = vi.fn().mockResolvedValue(undefined);
		const store = createStateManager(createMockState({ callbacks: { saveSession } }));
		const events = createMockEventDispatcherWithVitest();
		const dispose = sessionPersistence(store, events);
		dispose();
		store.set('codeBlockRendering.codeBlocks', []);
		expect(saveSession).not.toHaveBeenCalled();
		expect(events.off).toHaveBeenCalledWith('saveSession', expect.any(Function));
		store.dispose();
	});
});
