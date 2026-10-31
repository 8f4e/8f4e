import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import createStateManager, { type StateManager } from '@8f4e/state-manager';
import type { SpriteId } from 'glugglugglug';
import { describe, expect, it, vi } from 'vitest';
import createWebUiRenderProjection from './projection';
import { createSpriteCell } from './spriteCell';

const cell = (id: number, color: number) => createSpriteCell(id as SpriteId, color);

describe('createWebUiRenderProjection', () => {
	it('keeps text render data when info records change', () => {
		const store = createStateManager(
			createMockState({ codeBlockRendering: { codeBlocks: [createMockCodeBlock({ code: ['module audio'] })] } })
		);
		const events = { on: vi.fn(), off: vi.fn() } as unknown as Pick<EventDispatcher, 'on' | 'off'>;
		const projection = createWebUiRenderProjection(store, events);
		const snapshot = projection.getSnapshot();

		store.set('info.graphics', { fps: 60 });
		store.set('info.graphics', { fps: 30, timeToRenderMs: 12 });

		expect(projection.getSnapshot()).toBe(snapshot);
		projection.dispose();
		store.dispose();
	});

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
		const state = createMockState({
			codeBlockRendering: { codeBlocks: [block] },
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
		expect(events.on).toHaveBeenCalledWith('memoryValuesChanged', expect.any(Function));

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

		block.gaps = new Map([[0, { size: 2 }]]);
		const fontChanged = vi.mocked(events.on).mock.calls.find(([name]) => name === 'spriteSheetRerendered')?.[1];
		fontChanged?.({});
		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells).toHaveLength(3);

		block.gaps = new Map([[0, { size: 4 }]]);
		const layoutRefreshed = vi.mocked(events.on).mock.calls.find(([name]) => name === 'codeBlockLayoutsChanged')?.[1];
		layoutRefreshed?.({});
		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells).toHaveLength(5);

		projection.dispose();
		expect(store.unsubscribe).toHaveBeenCalledWith('codeBlockRendering', expect.any(Function));
		expect(events.off).toHaveBeenCalledWith('memoryValuesChanged', expect.any(Function));
		expect(events.off).toHaveBeenCalledWith('codeBlockLayoutsChanged', expect.any(Function));
	});
});
