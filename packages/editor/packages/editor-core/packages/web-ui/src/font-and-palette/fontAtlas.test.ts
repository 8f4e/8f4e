import { createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import type { FontAtlas } from '@8f4e/sprite-generator';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFontAtlasController } from './fontAtlas';

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

function createAtlas(cellWidth = 8, cellHeight = 16): FontAtlas {
	return {
		image: { width: cellWidth * 16, height: cellHeight * 17, data: new Uint8Array(cellWidth * 16 * cellHeight * 17) },
		grid: { cellWidth, cellHeight, columns: 16, cellCount: 257 },
	};
}

function setup() {
	const state = createMockState({ editorConfig: { font: 'ibmvga8x16', color: { primary: '#ffffff' } } });
	const store = createStateManager(state);
	const engine = { setSpriteAtlas: vi.fn(), drawSprite: vi.fn() };
	const loading = { add: vi.fn(() => ({ done: vi.fn(), fail: vi.fn(), cancel: vi.fn() })) };
	const events = { ...createMockEventDispatcher(), dispatch: vi.fn() };
	const fonts = createFontAtlasController(store, events, loading, engine, {
		font: 'ibmvga8x16',
		atlas: createAtlas(),
	});
	const dispose = fonts.subscribe();
	engine.setSpriteAtlas.mockClear();
	events.dispatch.mockClear();
	cleanups.push(store.dispose, dispose);
	return { state, store, engine, events, dispose, loading };
}

describe('font atlas replacements', () => {
	beforeEach(() => loadFontAtlas.mockReset());

	it('loads the temporary font independently of authored configuration and restores the latest authored font', async () => {
		const test = setup();
		const preview = deferred<FontAtlas>();
		const restored = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(preview.promise).mockReturnValueOnce(restored.promise);
		test.store.set('appearance.fontOverride', 'x11miscfixed6x10');
		test.store.set('editorConfig.font', 'terminus10x18');
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('x11miscfixed6x10');
		const previewAtlas = createAtlas(6, 10);
		preview.resolve(previewAtlas);
		await preview.promise;
		expect(test.engine.setSpriteAtlas).toHaveBeenCalledExactlyOnceWith(previewAtlas.image, previewAtlas.grid);
		expect(test.state.editorConfig.font).toBe('terminus10x18');

		test.store.set('appearance.fontOverride', undefined);
		expect(loadFontAtlas.mock.calls).toEqual([['x11miscfixed6x10'], ['terminus10x18']]);
		const restoredAtlas = createAtlas(10, 18);
		restored.resolve(restoredAtlas);
		await restored.promise;
		expect(test.engine.setSpriteAtlas).toHaveBeenLastCalledWith(restoredAtlas.image, restoredAtlas.grid);
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
		const atlas = createAtlas(6, 10);
		preview.resolve(atlas);
		await preview.promise;
		expect(test.engine.setSpriteAtlas).toHaveBeenCalledExactlyOnceWith(atlas.image, atlas.grid);
	});

	it('installs only the newest font', async () => {
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
		const atlas = createAtlas(6, 10);
		test.events.dispatch.mockImplementation((name: string) => {
			if (name === 'gridSizeChanged' || name === 'fontChanged') {
				expect(test.engine.setSpriteAtlas).toHaveBeenCalledExactlyOnceWith(atlas.image, atlas.grid);
				expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
				expect(test.state.gridSizeReady).toBe(name === 'fontChanged');
			}
		});
		newer.resolve(atlas);
		await newer.promise;
		older.resolve(createAtlas());
		await older.promise;
		expect(test.engine.setSpriteAtlas).toHaveBeenCalledExactlyOnceWith(atlas.image, atlas.grid);
		expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
		expect(test.state.gridSizeReady).toBe(true);
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
		pending.resolve(createAtlas());
		await pending.promise;
		expect(test.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(loadFontAtlas).toHaveBeenCalledOnce();
	});

	it('replaces equal-size font masks without invalidating layout', async () => {
		const test = setup();
		const atlas = createAtlas(8, 16);
		loadFontAtlas.mockResolvedValueOnce(atlas);
		test.store.set('editorConfig.font', 'terminus8x16');
		expect(test.state.gridSizeReady).toBe(false);
		await Promise.resolve();
		expect(test.engine.setSpriteAtlas).toHaveBeenCalledExactlyOnceWith(atlas.image, atlas.grid);
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
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		pending.resolve(createAtlas());
		await pending.promise;
		expect(loadFontAtlas).toHaveBeenCalledExactlyOnceWith('terminus8x16');
		expect(test.loading.add).toHaveBeenCalledOnce();
		expect(test.engine.setSpriteAtlas).not.toHaveBeenCalled();
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
		older.resolve(createAtlas());
		await older.promise;
		expect(test.state.gridSizeReady).toBe(false);
		newer.resolve(createAtlas(6, 10));
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
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		pending.reject(error);
		await pending.promise.catch(() => undefined);
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.state.viewport).toMatchObject({ hGrid: 16, vGrid: 8 });
		expect(test.engine.setSpriteAtlas).not.toHaveBeenCalled();
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
		expect(test.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[0].value.cancel).toHaveBeenCalled();
		expect(test.loading.add.mock.results[0].value.fail).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[1].value.cancel).not.toHaveBeenCalled();
		expect(test.loading.add.mock.results[1].value.fail).not.toHaveBeenCalled();
		expect(test.state.console.logs).toEqual([]);
		const atlas = createAtlas(6, 10);
		newer.resolve(atlas);
		await newer.promise;
		expect(test.state.gridSizeReady).toBe(true);
		expect(test.state.viewport).toMatchObject({ hGrid: 10, vGrid: 6 });
		expect(test.engine.setSpriteAtlas).toHaveBeenCalledExactlyOnceWith(atlas.image, atlas.grid);
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
		expect(test.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(test.state.console.logs).toEqual([]);
	});

	it('ignores configuration resolving to the same active default font', () => {
		const test = setup();
		test.store.set('editorConfig', { color: { primary: '#00ff00' } });
		expect(loadFontAtlas).not.toHaveBeenCalled();
		expect(test.loading.add).not.toHaveBeenCalled();
		expect(test.engine.setSpriteAtlas).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
	});
});
