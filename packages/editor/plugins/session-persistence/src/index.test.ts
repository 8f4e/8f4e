import { parseProjectSource } from '@8f4e/compiler';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPlugin } from './__tests__/setup';
import { createSessionPersistencePlugin } from './index';

const cleanups: Array<() => void> = [];
const project = parseProjectSource(
	'8f4e/v1\nentry main\nmodule retained\n; @pos 4 3\nint value 1\nmoduleEnd\nentryEnd'
);
function createStorage() {
	const values = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value);
		}),
	};
}
function setup(storage = createStorage(), restoreOnStartup = true, storageKey = 'session') {
	const test = setupPlugin(createSessionPersistencePlugin({ storage, storageKey, restoreOnStartup }));
	cleanups.push(test.dispose);
	const boot = () => {
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		test.events.dispatch('init');
	};
	return { ...test, storage, boot };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('session persistence plugin', () => {
	it('restores on init before starting autosaves', () => {
		const storage = createStorage();
		storage.setItem('session', JSON.stringify(project));
		storage.setItem.mockClear();
		const test = setup(storage);
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(storage.setItem).not.toHaveBeenCalled();
		test.events.dispatch('init');
		expect(test.state.codeBlockRendering.codeBlocks.some(block => block.name === 'retained')).toBe(true);
		expect(JSON.parse(storage.getItem('session')!).modules[0].code).toContain('module retained');
		expect(storage.setItem).toHaveBeenCalledOnce();
	});

	it('keeps an empty project when no session exists', () => {
		const test = setup();
		test.boot();
		expect(test.state.initialProjectState).toMatchObject({ modules: [], notes: [], groups: [] });
		expect(JSON.parse(test.storage.getItem('session')!).modules).toEqual([]);
	});

	it('skips restoration and keeps autosaving enabled when startup belongs to another loader', () => {
		const storage = createStorage();
		storage.setItem('session', JSON.stringify(project));
		const test = setup(storage, false);
		test.boot();
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(test.state.codeBlockRendering.codeBlocks.some(block => block.name === 'retained')).toBe(false);
		expect(storage.setItem).toHaveBeenCalledWith('session', expect.any(String));
		test.events.dispatch('loadProject', { project });
		expect(JSON.parse(storage.getItem('session')!).modules[0].code).toContain('module retained');
	});

	it('autosaves source edits, programmatic edits, and deletion', () => {
		const test = setup();
		test.boot();
		test.events.dispatch('loadProject', { project });
		const block = test.state.codeBlockRendering.codeBlocks.find(block => block.name === 'retained')!;
		test.store.set('codeBlockRendering.selectedCodeBlock', block);
		test.store.set('codeBlockRendering.selectedCodeBlock.code', ['module retained', 'int value 2', 'moduleEnd']);
		expect(JSON.parse(test.storage.getItem('session')!).modules[0].code).toContain('int value 2');
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', [
			'module retained',
			'int value 3',
			'moduleEnd',
		]);
		expect(JSON.parse(test.storage.getItem('session')!).modules[0].code).toContain('int value 3');
		test.events.dispatch('deleteCodeBlock', { codeBlock: block });
		expect(JSON.parse(test.storage.getItem('session')!).modules).toEqual([]);
	});

	it('saves the root project while navigating a nested project slice', () => {
		const test = setup();
		test.boot();
		const grouped = parseProjectSource(
			'8f4e/v1\nentry main\ngroup voice\nmodule oscillator\nmoduleEnd\ngroupEnd\nentryEnd'
		);
		test.events.dispatch('loadProject', { project: grouped });
		const group = test.state.codeBlockRendering.codeBlocks.find(block => block.name === 'voice')!;
		test.store.set('codeBlockRendering.codeBlocks', group.nestedProjectCodeBlocks!);
		expect(JSON.parse(test.storage.getItem('session')!).groups[0].name).toBe('voice');
	});

	it('isolates storage keys and disposes its subscriptions and listeners', () => {
		const storage = createStorage();
		const first = setup(storage, false, 'first');
		const second = setup(storage, false, 'second');
		first.boot();
		second.boot();
		first.events.dispatch('loadProject', { project });
		expect(JSON.parse(storage.getItem('first')!).modules).toHaveLength(1);
		expect(JSON.parse(storage.getItem('second')!).modules).toEqual([]);
		first.disposePlugin();
		storage.setItem.mockClear();
		first.store.set('codeBlockRendering.codeBlocks', []);
		first.events.dispatch('init');
		expect(storage.setItem).not.toHaveBeenCalled();
		second.events.dispatch('loadProject', { project });
		expect(JSON.parse(storage.getItem('second')!).modules).toHaveLength(1);
	});

	it('reports unreadable stored JSON and continues with the empty project', () => {
		const storage = createStorage();
		storage.setItem('session', '{');
		const test = setup(storage);
		test.boot();
		expect(test.state.console.logs.some(log => log.message.includes('Failed to restore editor session'))).toBe(true);
		expect(test.state.initialProjectState).toMatchObject({ modules: [], notes: [], groups: [] });
	});

	it('reports storage write failures without interrupting source edits', () => {
		const storage = createStorage();
		storage.setItem.mockImplementation(() => {
			throw new Error('Storage full');
		});
		const test = setup(storage);
		test.boot();
		test.events.dispatch('loadProject', { project });
		expect(test.state.codeBlockRendering.codeBlocks.some(block => block.name === 'retained')).toBe(true);
		expect(test.state.console.logs.some(log => log.message.includes('Storage full'))).toBe(true);
	});
});
