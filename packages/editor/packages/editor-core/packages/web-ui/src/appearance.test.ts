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
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
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

	it('loads the temporary font independently of authored configuration and restores the latest authored font', async () => {
		const test = setup();
		const preview = deferred<FontAtlas>();
		const restored = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(preview.promise).mockReturnValueOnce(restored.promise);
		test.store.set('appearance.fontOverride', 'x11miscfixed6x10');
		test.store.set('editorConfig.font', 'terminus10x18');
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('x11miscfixed6x10');
		const previewAtlas = { grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas;
		preview.resolve(previewAtlas);
		await preview.promise;
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(previewAtlas);
		expect(test.state.editorConfig.font).toBe('terminus10x18');

		test.store.set('appearance.fontOverride', undefined);
		expect(loadFontAtlas.mock.calls).toEqual([['x11miscfixed6x10'], ['terminus10x18']]);
		const restoredAtlas = { grid: { cellWidth: 10, cellHeight: 18 } } as FontAtlas;
		restored.resolve(restoredAtlas);
		await restored.promise;
		expect(test.applyFont).toHaveBeenLastCalledWith(restoredAtlas);
		expect(test.state.viewport).toMatchObject({ vGrid: 10, hGrid: 18 });
	});

	it('does not restart a pending preview that becomes the authored font', async () => {
		const test = setup();
		const preview = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(preview.promise);
		test.store.set('appearance.fontOverride', 'x11miscfixed6x10');
		test.store.set('editorConfig.font', 'x11miscfixed6x10');
		test.store.set('appearance.fontOverride', undefined);
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('x11miscfixed6x10');
		const atlas = { grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas;
		preview.resolve(atlas);
		await preview.promise;
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas);
	});

	it('installs only the newest font without changing the independently updated palette', async () => {
		const test = setup();
		const older = deferred<FontAtlas>();
		const newer = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		expect(test.state.gridSizeReady).toBe(false);
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		test.store.set('editorConfig.font', 'x11miscfixed6x10');
		expect(test.loading.add).toHaveBeenNthCalledWith(1, { id: 'font', message: 'Loading font terminus8x16...' });
		expect(test.loading.add).toHaveBeenNthCalledWith(2, { id: 'font', message: 'Loading font x11miscfixed6x10...' });
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		expect(test.loading.add.mock.results[1].value.cancel).not.toHaveBeenCalled();
		test.store.set('editorConfig.color', { primary: '#00ff00' });
		const atlas = { grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas;
		test.events.dispatch.mockImplementation((name: string) => {
			if (name === 'gridSizeChanged' || name === 'fontChanged') {
				expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas);
				expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
				expect(test.state.gridSizeReady).toBe(name === 'fontChanged');
			}
		});
		newer.resolve(atlas);
		await newer.promise;
		older.resolve({} as FontAtlas);
		await older.promise;
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas);
		expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.applyPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette({ primary: '#00ff00' }));
		expect(loadFontAtlas.mock.calls).toEqual([['terminus8x16'], ['x11miscfixed6x10']]);
		expect(test.events.dispatch.mock.calls).toEqual([
			['gridSizeChanged'],
			['fontChanged', { font: 'x11miscfixed6x10' }],
		]);
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
		expect(test.state.gridSizeReady).toBe(false);
		await Promise.resolve();
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas);
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith('fontChanged', { font: 'terminus8x16' });
	});

	it('cancels a pending change when returning to the active font without loading or uploading it again', async () => {
		const test = setup();
		const pending = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(pending.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		expect(test.state.gridSizeReady).toBe(false);
		test.store.set('editorConfig.font', 'ibmvga8x16');
		// Source refresh resolves configuration before its layout settles; readiness must wait until it returns.
		expect(test.state.gridSizeReady).toBe(false);
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(test.state.gridSizeReady).toBe(true);
		pending.resolve({} as FontAtlas);
		await pending.promise;
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('terminus8x16');
		expect(test.loading.add).toHaveBeenCalledOnce();
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
	});

	it('ignores readiness from a reversion superseded before source layout settles', async () => {
		const test = setup();
		const older = deferred<FontAtlas>();
		const newer = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		test.store.set('editorConfig.font', 'ibmvga8x16');
		test.store.set('editorConfig.font', 'x11miscfixed6x10');
		await Promise.resolve();
		expect(test.state.gridSizeReady).toBe(false);
		expect(test.events.dispatch).not.toHaveBeenCalled();
		older.resolve({} as FontAtlas);
		await older.promise;
		expect(test.state.gridSizeReady).toBe(false);
		newer.resolve({ grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas);
		await newer.promise;
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.events.dispatch.mock.calls).toEqual([
			['gridSizeChanged'],
			['fontChanged', { font: 'x11miscfixed6x10' }],
		]);
	});

	it('restores readiness for the active grid when the current replacement font fails', async () => {
		const test = setup();
		const pending = deferred<FontAtlas>();
		const error = new Error('Font unavailable');
		loadFontAtlas.mockReturnValueOnce(pending.promise);
		test.store.set('editorConfig.font', 'x11miscfixed6x10');
		expect(test.state.gridSizeReady).toBe(false);
		pending.reject(error);
		await pending.promise.catch(() => undefined);
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[0].value.fail).toHaveBeenCalledOnce();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(test.state.console.logs).toEqual([
			expect.objectContaining({
				level: 'error',
				message: 'Failed to load font x11miscfixed6x10: Error: Font unavailable',
			}),
		]);
	});

	it('does not restore readiness when a superseded replacement font fails', async () => {
		const test = setup();
		const older = deferred<FontAtlas>();
		const newer = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		test.store.set('editorConfig.font', 'x11miscfixed6x10');
		older.reject(new Error('Font unavailable'));
		await older.promise.catch(() => undefined);
		expect(test.state.gridSizeReady).toBe(false);
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		expect(test.loading.add.mock.results[0].value.fail).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[1].value.cancel).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[1].value.fail).not.toHaveBeenCalled();
		expect(test.state.console.logs).toEqual([]);
		const atlas = { grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas;
		newer.resolve(atlas);
		await newer.promise;
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
		expect(test.applyFont).toHaveBeenCalledExactlyOnceWith(atlas);
		expect(test.loading.add.mock.results[1].value.done).toHaveBeenCalledOnce();
	});

	it('ignores a rejected font load after disposal', async () => {
		const test = setup();
		const pending = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(pending.promise);
		test.store.set('editorConfig.font', 'terminus8x16');
		test.dispose();
		pending.reject(new Error('Font unavailable'));
		await pending.promise.catch(() => undefined);
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		expect(test.loading.add.mock.results[0].value.fail).not.toHaveBeenCalled();
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(test.state.console.logs).toEqual([]);
	});

	it('ignores configuration resolving to the same active default font', () => {
		const test = setup();
		test.store.set('editorConfig', { color: { primary: '#00ff00' } });
		expect(loadFontAtlas).not.toHaveBeenCalled();
		expect(test.loading.add).not.toHaveBeenCalled();
		expect(test.applyFont).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
	});
});
