import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createDrawContextMock, createSpriteIdLookupMock } from './__tests__/rendering';
import { tooltipsPlugin } from './index';

const cleanups: Array<() => void> = [];

async function setup(installed = true) {
	const project = parseProjectSource(`8f4e/v1
entry main
module controls
int gate 0
push 1
push 2
add
drop
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { disableSharedMemory: true, includeStackAnalysis: true });
	const events = createEvents();
	const store = initState(events, {
		initialEditorMode: 'edit',
		runtimeRegistry: {},
		callbacks: { loadSession: async () => null },
	});
	const drawers = createCodeBlockDrawerRegistry();
	const dispose = installed
		? tooltipsPlugin.setup({ store, events, menus: store.menus, directives: store.directives, drawers })
		: () => {};
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	const state = store.getState();
	Object.assign(state.compiler, compiled);
	store.set('initialProjectState', project);
	store.set('spriteLookups', {
		fillColors: createSpriteIdLookupMock(),
		fontInverseInk: createSpriteIdLookupMock(),
		fontInverseAccent: createSpriteIdLookupMock(),
	} as never);
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === 'controls')!;
	store.set('codeBlockRendering.selectedCodeBlock', codeBlock);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 4);
	const buffer = new ArrayBuffer(65536);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		uint8: new Uint8Array(buffer),
		uint16: new Uint16Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
	const draw = createDrawContextMock();
	const render = () => {
		vi.mocked(draw.drawSprite).mockClear();
		drawers.drawCodeBlockOverlay({ draw, state, codeBlock, memoryViews });
	};
	return { store, state, events, draw, render, dispose };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

describe('tooltips plugin', () => {
	it('draws selected-line documentation and compiler stack analysis through the overlay contribution', async () => {
		const test = await setup();
		test.render();
		expect(test.draw.drawSprite).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'inverseSurface',
			expect.any(Number),
			5 * 16
		);
		expect(vi.mocked(test.draw.drawSprite).mock.calls.map(call => call[2])).toContain('negativeSoft');
		expect(test.state).not.toHaveProperty('tooltip');
		test.store.set('codeBlockRendering.selectedCodeBlock', undefined);
		test.render();
		expect(test.draw.drawSprite).not.toHaveBeenCalled();
	});

	it('has no tooltip contribution when omitted or disposed', async () => {
		const omitted = await setup(false);
		omitted.render();
		expect(omitted.draw.drawSprite).not.toHaveBeenCalled();
		const installed = await setup();
		installed.dispose();
		installed.render();
		expect(installed.draw.drawSprite).not.toHaveBeenCalled();
	});

	it('keeps tooltip state and registrations independent across editors', async () => {
		const first = await setup();
		const second = await setup();
		first.dispose();
		first.render();
		second.render();
		expect(first.draw.drawSprite).not.toHaveBeenCalled();
		expect(second.draw.drawSprite).toHaveBeenCalled();
	});
});
