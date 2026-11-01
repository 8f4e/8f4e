import { resolvePalette } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { FontAtlas } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpriteSheetManager } from './spriteSheetManager';

const { loadFontAtlas } = vi.hoisted(() => ({ loadFontAtlas: vi.fn() }));
vi.mock('@8f4e/sprite-generator', () => ({ default: loadFontAtlas }));
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => {
		resolve = done;
	});
	return { promise, resolve };
}
function setup() {
	const state = createMockState();
	state.editorConfig = { font: 'ibmvga8x16', color: { primary: '#ffffff' } };
	const subscriptions = new Map<string, () => void | Promise<void>>();
	const store = {
		getState: () => state,
		subscribe: vi.fn((key: string, callback: () => void | Promise<void>) => subscriptions.set(key, callback)),
		unsubscribe: vi.fn((key: string) => subscriptions.delete(key)),
	} as unknown as StateManager<State>;
	const view = { loadFontAtlas: vi.fn(), loadPalette: vi.fn() };
	const events = { dispatch: vi.fn() };
	const dispose = createSpriteSheetManager(store, view, events as never);
	return { state, store, view, events, subscriptions, dispose };
}
describe('sprite sheet manager', () => {
	beforeEach(() => loadFontAtlas.mockReset());
	it('updates only the palette on a theme change without rebuilding masks or projections', () => {
		const test = setup();
		test.state.editorConfig.color = { primary: 'rgba(255,0,0,0.5)' };
		test.subscriptions.get('editorConfig.color')?.();
		expect(test.view.loadPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette(test.state.editorConfig.color));
		expect(loadFontAtlas).not.toHaveBeenCalled();
		expect(test.view.loadFontAtlas).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		test.dispose();
	});
	it('installs only the newest font build without changing the independently updated palette', async () => {
		const test = setup();
		const older = deferred<FontAtlas>();
		const newer = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const oldRequest = test.subscriptions.get('editorConfig.font')?.();
		test.state.editorConfig.font = '6x10';
		const newRequest = test.subscriptions.get('editorConfig.font')?.();
		test.state.editorConfig.color = { primary: '#00ff00' };
		test.subscriptions.get('editorConfig.color')?.();
		const bundle = { grid: { cellWidth: 6, cellHeight: 10 } } as FontAtlas;
		newer.resolve(bundle);
		await newRequest;
		older.resolve({} as FontAtlas);
		await oldRequest;
		expect(test.view.loadFontAtlas).toHaveBeenCalledExactlyOnceWith(bundle, '6x10');
		expect(test.state.viewport).toEqual(expect.objectContaining({ hGrid: 10, vGrid: 6 }));
		expect(test.view.loadPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette({ primary: '#00ff00' }));
		expect(loadFontAtlas).toHaveBeenNthCalledWith(1, 'ibmvga8x16');
		expect(loadFontAtlas).toHaveBeenNthCalledWith(2, '6x10');
		expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith('spriteSheetRerendered');
		expect(loadFontAtlas).toHaveBeenCalledTimes(2);
		test.dispose();
	});
	it('unsubscribes and ignores pending font work and captured palette callbacks after disposal', async () => {
		const test = setup();
		const pending = deferred<FontAtlas>();
		loadFontAtlas.mockReturnValueOnce(pending.promise);
		const request = test.subscriptions.get('editorConfig.font')?.();
		const color = test.subscriptions.get('editorConfig.color');
		test.dispose();
		test.dispose();
		color?.();
		pending.resolve({} as FontAtlas);
		await request;
		expect(test.view.loadFontAtlas).not.toHaveBeenCalled();
		expect(test.view.loadPalette).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(test.store.unsubscribe).toHaveBeenCalledTimes(2);
	});
});
