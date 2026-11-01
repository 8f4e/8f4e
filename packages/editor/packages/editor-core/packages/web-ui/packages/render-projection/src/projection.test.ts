import { EventEmitter } from 'node:events';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import type { SpriteId } from 'glugglugglug';
import { expect, it } from 'vitest';
import createWebUiRenderProjection from './projection';
import { createSpriteCell } from './spriteCell';

const cell = (id: number, color: number) => createSpriteCell(id as SpriteId, color);

it('projects completed layouts and stops refreshing after disposal', () => {
	const block = createMockCodeBlock({ creationIndex: 7, code: ['x'] });
	const store = createStateManager(
		createMockState({ codeBlockRendering: { currentProject: { path: '', blocks: [block] } } })
	);
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter) };
	const projection = createWebUiRenderProjection(store, events);
	try {
		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells[0]?.at(-1)).toEqual(
			cell(120, PALETTE_INDICES.inkBase)
		);

		block.code = ['y'];
		block.displayModel.lines[0].text = 'y';
		block.gaps = new Map([[0, { size: 2 }]]);
		emitter.emit('codeBlockLayoutsChanged');
		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells[0]?.at(-1)).toEqual(
			cell(121, PALETTE_INDICES.inkBase)
		);
		expect(projection.getSnapshot().codeBlocks.get(7)?.codeCells).toHaveLength(3);

		const last = projection.getSnapshot();
		projection.dispose();
		block.gaps = new Map();
		emitter.emit('codeBlockLayoutsChanged');
		expect(projection.getSnapshot()).toBe(last);
	} finally {
		projection.dispose();
		store.dispose();
	}
});
