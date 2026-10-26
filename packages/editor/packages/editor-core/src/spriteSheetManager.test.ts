import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import type { SpriteData } from '@8f4e/web-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpriteSheetManager } from './spriteSheetManager';

const { generateSprite } = vi.hoisted(() => ({ generateSprite: vi.fn() }));

vi.mock('@8f4e/sprite-generator', () => ({ default: generateSprite }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(resolvePromise => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe('sprite sheet manager', () => {
	beforeEach(() => {
		generateSprite.mockReset();
	});

	it('unsubscribes and ignores sprite generation that finishes after disposal', async () => {
		const state = createMockState();
		state.editorConfig = { font: 'terminus8x16', color: {} };
		const subscriptions = new Map<string, () => Promise<void>>();
		const store = {
			getState: () => state,
			subscribe: vi.fn((selector: string, callback: () => Promise<void>) => subscriptions.set(selector, callback)),
			unsubscribe: vi.fn((selector: string, callback: () => Promise<void>) => {
				if (subscriptions.get(selector) === callback) {
					subscriptions.delete(selector);
				}
			}),
		} as unknown as StateManager<State>;
		const view = { loadSpriteAtlas: vi.fn() };
		const events = { dispatch: vi.fn() };
		const pendingSprite = deferred<SpriteData>();
		generateSprite.mockReturnValueOnce(pendingSprite.promise);
		const dispose = createSpriteSheetManager(store, view, events as never);

		const rerender = subscriptions.get('editorConfig.font');
		expect(rerender).toBeDefined();
		const rerenderPromise = rerender?.() as Promise<void>;
		dispose();
		pendingSprite.resolve({} as SpriteData);
		await rerenderPromise;

		expect(store.unsubscribe).toHaveBeenCalledWith('editorConfig.font', rerender);
		expect(store.unsubscribe).toHaveBeenCalledWith('editorConfig.color', expect.any(Function));
		expect(view.loadSpriteAtlas).not.toHaveBeenCalled();
		expect(events.dispatch).not.toHaveBeenCalled();
	});
});
