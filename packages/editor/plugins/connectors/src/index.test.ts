import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import initWebUi, { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { connectorsPlugin } from './index';

const source = `8f4e/v1
entry main
module source
; @pos 50 1
float output 1
moduleEnd
module sink
; @pos 2 1
float* input &source:output
moduleEnd
entryEnd`;

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

async function setup(text = source) {
	const project = parseProjectSource(text);
	const compiled = await compileProject(project);
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const memoryViews: MemoryViews = {
		int8: new Int8Array(memory.buffer),
		uint8: new Uint8Array(memory.buffer),
		int16: new Int16Array(memory.buffer),
		uint16: new Uint16Array(memory.buffer),
		int32: new Int32Array(memory.buffer),
		float32: new Float32Array(memory.buffer),
		float64: new Float64Array(memory.buffer),
	};
	const events = createEvents();
	const store = initState(events, { callbacks: { getWordFromMemory: address => memoryViews.int32[address] } });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	const drawers = createEditorDrawerRegistry();
	const registerRenderLayer = vi.spyOn(drawers, 'registerRenderLayer');
	const dispose = connectorsPlugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	const state = store.getState();
	events.dispatch('loadProject', { project });
	store.set('compiler.result', { ...compiled, inputRevision: state.compilerInputRevision });

	const connectorPositions = (codeBlock: EditorCodeBlock) => {
		const drawFill = vi.fn();
		drawers.drawCodeBlock({
			draw: { drawFill, drawSprite: vi.fn() } as unknown as DrawContext,
			state,
			codeBlock,
			memoryViews,
		});
		return drawFill.mock.calls.map(([x, y]) => ({ x, y }));
	};
	cleanups.push(store.dispose, dispose);
	return { store, state, events, drawers, memoryViews, registerRenderLayer, connectorPositions };
}

describe('connectors plugin', () => {
	it('renders connector sprites without registering a GPU wire pass', async () => {
		const { store, events, drawers, memoryViews, registerRenderLayer } = await setup();
		const width = 800;
		const height = 320;
		store.set('viewport.width', width);
		store.set('viewport.height', height);
		const ascii = new AsciiRenderer(width, height);
		const view = await initWebUi(store, events, ascii, memoryViews, { drawers, loading: store.loading });
		cleanups.push(view.destroy);
		view.renderFrame();
		const frame = ascii.toText();
		expect(frame).toContain('[ ]');
		expect(frame).toContain('[*]');
		expect(registerRenderLayer).not.toHaveBeenCalled();
	});

	it('positions connector sprites after another plugin adds rows', async () => {
		const { state, store, connectorPositions } = await setup();
		const sink = state.project.activeLevel.blocks.find(block => block.name === 'sink')!;
		const contribution = store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(sink, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(connectorPositions(sink)).toContainEqual({ x: 0, y: 4 * state.viewport.hGrid });
	});

	it('reads the relocated memory declaration after accepting compiler metadata', async () => {
		const { store, state, drawers, memoryViews } = await setup();
		const block = state.project.activeLevel.blocks.find(block => block.name === 'source')!;
		const original = state.compiler.result.memoryPlan.modules.source.memory.output;
		const compiled = await compileProject(parseProjectSource(source), { startingMemoryAllocationUnitAddress: 16 });
		const relocated = compiled.memoryPlan.modules.source.memory.output;
		expect(relocated.allocationUnitAddress).not.toBe(original.allocationUnitAddress);
		memoryViews.float32[original.allocationUnitAddress] = -1;
		memoryViews.float32[relocated.allocationUnitAddress] = 1;

		const markerColor = () => {
			const drawSprite = vi.fn();
			drawers.drawCodeBlock({
				draw: { drawFill: vi.fn(), drawSprite } as unknown as DrawContext,
				state,
				codeBlock: block,
				memoryViews,
			});
			return drawSprite.mock.calls.find(([, , glyph]) => glyph === 42)?.[3];
		};

		expect(markerColor()).toBe(PALETTE_INDICES.primaryDark3);
		store.set('compiler.result', { ...compiled, inputRevision: state.compilerInputRevision });
		expect(markerColor()).toBe(PALETTE_INDICES.negativeBase);
	});

	it('follows moved and removed exposures before a new compiler result is accepted', async () => {
		const test = await setup(`8f4e/v1
entry main
group patch
expose output &source:value
entry main
module source
float value 1
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const group = test.state.project.activeLevel.blocks.find(block => block.name === 'patch')!;
		const { hGrid } = test.state.viewport;
		const rows = () => test.connectorPositions(group).map(position => position.y);
		expect(rows()).toEqual([hGrid]);

		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: group, code: [group.code[0], '', '', ...group.code.slice(1)] },
		]);
		expect(rows()).toEqual([3 * hGrid]);

		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: group, code: group.code.filter(line => !line.startsWith('expose ')) },
		]);
		expect(rows()).toEqual([]);
	});
});
