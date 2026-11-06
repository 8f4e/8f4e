import { resolvePalette } from '@8f4e/editor-palette';
import { createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import type { FontAtlas } from '@8f4e/sprite-generator';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToAppearance } from './appearance';

const { loadFontAtlas } = vi.hoisted(() => ({ loadFontAtlas: vi.fn() }));
vi.mock('@8f4e/sprite-generator', async original => ({
	...(await original<typeof import('@8f4e/sprite-generator')>()),
	default: loadFontAtlas,
}));

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => {
		resolve = done;
	});
	return { promise, resolve };
}

function setup() {
	const state = createMockState({ editorConfig: { font: 'ibmvga8x16', color: { primary: '#ffffff' } } });
	const store = createStateManager(state);
	const applyFont = vi.fn();
	const loading = { add: vi.fn(() => ({ done: vi.fn(), fail: vi.fn(), cancel: vi.fn() })) };
	const applyPalette = vi.fn();
	const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
	const dispose = subscribeToAppearance(store, events, loading, applyFont, applyPalette);
	cleanups.push(store.dispose, dispose);
	return { state, store, applyFont, applyPalette, events, dispose, loading };
}

describe('appearance subscriptions', () => {
	beforeEach(() => loadFontAtlas.mockReset());

	it('updates only the palette on a theme change', () => {
		const test = setup();
		test.store.set('editorConfig.color', { primary: 'rgba(255,0,0,0.5)' });
		expect(test.applyPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette({ primary: 'rgba(255,0,0,0.5)' }));
		expect(loadFontAtlas).not.toHaveBeenCalled();
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
	});

	it('installs only the newest font without changing the independently updated palette', async () => {
		const test = setup();
		const older = deferred<FontAtlas>();
		const newer = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		test.store.set('editorConfig.font', 'x11miscfixed6x10');
		expect(test.loading.add).toHaveBeenNthCalledWith(1, { id: 'font', message: 'Loading font terminus8x16...' });
		expect(test.loading.add).toHaveBeenNthCalledWith(2, { id: 'font', message: 'Loading font x11miscfixed6x10...' });
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		expect(test.loading.add.mock.results[1].value.cancel).not.toHaveBeenCalled();
		test.store.set('editorConfig.color', { primary: '#00ff00' });
		const atlas = { grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas;
		newer.resolve(atlas);
		await newer.promise;
		older.resolve({} as FontAtlas);
		await older.promise;
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas, 'x11miscfixed6x10');
		expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
		expect(test.applyPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette({ primary: '#00ff00' }));
		expect(loadFontAtlas.mock.calls).toEqual([['terminus8x16'], ['x11miscfixed6x10']]);
		expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith('gridSizeChanged');
	});

	it('unsubscribes and ignores pending font work after disposal', async () => {
		const test = setup();
		const pending = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(pending.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		test.dispose();
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		test.store.set('editorConfig', { font: 'x11miscfixed6x10', color: { primary: '#00ff00' } });
		pending.resolve({} as FontAtlas);
		await pending.promise;
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.applyPalette).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(loadFontAtlas).toHaveBeenCalledOnce();
	});

	it('replaces equal-size font masks without invalidating layout', async () => {
		const test = setup();
		const atlas = { grid: { cellWidth: 8, cellHeight: 16 } } as FontAtlas;
		loadFontAtlas.mockResolvedValueOnce(atlas);
		test.store.set('editorConfig.font', 'terminus8x16');
		await Promise.resolve();
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas, 'terminus8x16');
		expect(test.events.dispatch).not.toHaveBeenCalled();
	});
});
