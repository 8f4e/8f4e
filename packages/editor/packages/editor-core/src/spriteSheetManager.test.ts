import { resolvePalette } from '@8f4e/editor-palette';
import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { SpriteData } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpriteSheetManager } from './spriteSheetManager';

const { generateSprite } = vi.hoisted(() => ({ generateSprite: vi.fn() }));
vi.mock('@8f4e/sprite-generator', () => ({ default: generateSprite }));
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
	const view = { loadSpriteAtlas: vi.fn(), loadPalette: vi.fn() };
	const events = { dispatch: vi.fn() };
	const dispose = createSpriteSheetManager(store, view, events as never);
	return { state, store, view, events, subscriptions, dispose };
}
describe('sprite sheet manager', () => {
	beforeEach(() => generateSprite.mockReset());
	it('updates only the palette on a theme change without rebuilding masks or projections', () => {
		const test = setup();
		test.state.editorConfig.color = { primary: 'rgba(255,0,0,0.5)' };
		test.subscriptions.get('editorConfig.color')?.();
		expect(test.view.loadPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette(test.state.editorConfig.color));
		expect(generateSprite).not.toHaveBeenCalled();
		expect(test.view.loadSpriteAtlas).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		test.dispose();
	});
	it('installs only the newest font build without changing the independently updated palette', async () => {
		const test = setup();
		const older = deferred<SpriteData>();
		const newer = deferred<SpriteData>();
		generateSprite.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const oldRequest = test.subscriptions.get('editorConfig.font')?.();
		test.state.editorConfig.font = '6x10';
		const newRequest = test.subscriptions.get('editorConfig.font')?.();
		test.state.editorConfig.color = { primary: '#00ff00' };
		test.subscriptions.get('editorConfig.color')?.();
		const bundle = { characterWidth: 6, characterHeight: 10 } as SpriteData;
		newer.resolve(bundle);
		await newRequest;
		older.resolve({} as SpriteData);
		await oldRequest;
		expect(test.view.loadSpriteAtlas).toHaveBeenCalledExactlyOnceWith(bundle);
		expect(test.view.loadPalette).toHaveBeenCalledExactlyOnceWith(resolvePalette({ primary: '#00ff00' }));
		expect(generateSprite).toHaveBeenNthCalledWith(1, { font: 'ibmvga8x16' });
		expect(generateSprite).toHaveBeenNthCalledWith(2, { font: '6x10' });
		expect(test.events.dispatch).toHaveBeenCalledExactlyOnceWith('spriteSheetRerendered');
		expect(generateSprite).toHaveBeenCalledTimes(2);
		test.dispose();
	});
	it('unsubscribes and ignores pending font work and captured palette callbacks after disposal', async () => {
		const test = setup();
		const pending = deferred<SpriteData>();
		generateSprite.mockReturnValueOnce(pending.promise);
		const request = test.subscriptions.get('editorConfig.font')?.();
		const color = test.subscriptions.get('editorConfig.color');
		test.dispose();
		test.dispose();
		color?.();
		pending.resolve({} as SpriteData);
		await request;
		expect(test.view.loadSpriteAtlas).not.toHaveBeenCalled();
		expect(test.view.loadPalette).not.toHaveBeenCalled();
		expect(test.events.dispatch).not.toHaveBeenCalled();
		expect(test.store.unsubscribe).toHaveBeenCalledTimes(2);
	});
});
