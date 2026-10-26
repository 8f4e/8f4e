import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { SpriteIdLookups } from '@8f4e/sprite-generator';
import { type SpriteId as CellSpriteId, createSpriteCell } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import createWebUiRenderProjection from './projection';

const cell = (id: number, color: number) => createSpriteCell(id as CellSpriteId, color);

describe('createWebUiRenderProjection', () => {
	it('subscribes beside editor-state and publishes render data by runtime id', () => {
		const block = createMockCodeBlock({
			creationIndex: 7,
			code: ['x'],
			blockType: 'unknown',
			disabled: false,
			lineNumberColumnWidth: 1,
			displayModel: {
				lines: [{ text: 'x', sourceLineIndex: 0 }],
				displayRowToSourceLineIndex: [0],
				sourceLineIndexToDisplayRow: [0],
				isCollapsed: false,
			},
			gaps: new Map(),
		});
		const font = new Proxy({ 63: 63 }, { get: (target, key) => target[Number(key) as 63] ?? Number(key) });
		const state = createMockState({
			codeBlockRendering: { codeBlocks: [block] },
			spriteLookups: { font, fill: 128, background: 129 } as SpriteIdLookups,
		});
		const subscriptions = new Map<string, () => void>();
		const store = {
			getState: () => state,
			subscribe: vi.fn((selector: string, callback: () => void) => subscriptions.set(selector, callback)),
			unsubscribe: vi.fn(),
		} as unknown as StateManager<State>;
		const events = { on: vi.fn(), off: vi.fn() } as unknown as Pick<EventDispatcher, 'on' | 'off'>;

		const projection = createWebUiRenderProjection(store, events);

		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells[0]?.at(-1)).toEqual(
			cell(120, PALETTE_INDICES.inkBase)
		);
		expect(store.subscribe).toHaveBeenCalledWith('codeBlockRendering', expect.any(Function));
		expect(events.on).toHaveBeenCalledWith('spriteSheetRerendered', expect.any(Function));

		block.code = ['y'];
		block.displayModel = {
			lines: [{ text: 'y', sourceLineIndex: 0 }],
			displayRowToSourceLineIndex: [0],
			sourceLineIndexToDisplayRow: [0],
			isCollapsed: false,
		};
		subscriptions.get('codeBlockRendering')?.();
		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells[0]?.at(-1)).toEqual(
			cell(121, PALETTE_INDICES.inkBase)
		);

		projection.dispose();
		expect(store.unsubscribe).toHaveBeenCalledWith('codeBlockRendering', expect.any(Function));
		expect(events.off).toHaveBeenCalledWith('spriteSheetRerendered', expect.any(Function));
	});
});
