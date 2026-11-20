import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits, deleteCodeBlocks, serializeProjectLevel } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import initWebUi, { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { type ConnectorConnectionVisitor, connectorsPlugin, createConnectorConnections } from './index';

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

async function setup(text = source, installed = true) {
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
	const drawers = createEditorDrawerRegistry();
	const registerRenderLayer = vi.spyOn(drawers, 'registerRenderLayer');
	const dispose = installed
		? connectorsPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers,
			})
		: undefined;
	const state = store.getState();
	Object.assign(state.compiler.result, {
		memoryPlan: compiled.memoryPlan,
		memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
		compiledModules: compiled.compiledModules,
		compiledFunctions: compiled.compiledFunctions,
		projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
	});
	const connections = createConnectorConnections(state, events);
	events.dispatch('loadProject', { project });
	const readConnections = () => {
		const endpoints: Array<Parameters<ConnectorConnectionVisitor>> = [];
		connections.visit(memoryViews.int32, (...endpoint) => endpoints.push(endpoint));
		return endpoints;
	};
	const connectorPositions = (codeBlock: CodeBlockGraphicData) => {
		const drawFill = vi.fn();
		drawers.drawCodeBlock({
			draw: { drawFill, drawSprite: vi.fn() } as unknown as DrawContext,
			state,
			codeBlock,
			memoryViews,
		});
		return drawFill.mock.calls.map(([x, y]) => ({ x, y }));
	};
	cleanups.push(store.dispose, connections.dispose);
	if (dispose) cleanups.push(dispose);
	return { store, state, events, drawers, memoryViews, registerRenderLayer, connectorPositions, readConnections };
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

	it('keeps connector sprites and wire endpoints aligned after another plugin adds rows', async () => {
		const { state, store, connectorPositions, readConnections } = await setup();
		const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
		const { hGrid, y } = state.viewport;
		const contribution = store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(sink, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(connectorPositions(sink)).toContainEqual({ x: 0, y: 4 * hGrid });
		expect(readConnections()).toHaveLength(1);
		expect(readConnections()[0][1]).toBe(sink.y + Math.round(4.5 * hGrid) - y);
	});

	it('resolves live pointer endpoints independently of block visibility', async () => {
		const { state, memoryViews, readConnections } = await setup(source, false);
		const output = state.compiler.result.memoryPlan.modules.source.memory.output;
		const input = state.compiler.result.memoryPlan.modules.sink.memory.input;
		state.codeBlockRendering.currentProject.blocks[0].x = -10000;
		state.codeBlockRendering.currentProject.blocks[1].x = 10000;
		expect(readConnections()).toHaveLength(1);
		memoryViews.int32[input.allocationUnitAddress] = 123456;
		expect(readConnections()).toHaveLength(0);
		memoryViews.int32[input.allocationUnitAddress] = output.byteAddress;
		expect(readConnections()).toHaveLength(1);
	});

	it('connects a double pointer to a pointer slot without a fixed reference', async () => {
		const { state, readConnections } = await setup(`8f4e/v1
entry main
module source
; @pos 30 2
int value 42
int* slot &value
moduleEnd
module sink
; @pos 2 12
int** input &source:slot
moduleEnd
entryEnd`);
		const sourceBlock = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'source')!;
		const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
		const { vGrid, hGrid, x, y } = state.viewport;
		const endpoints = readConnections();
		expect(endpoints).toHaveLength(2);
		expect(endpoints[1].slice(0, 4)).toEqual([
			sink.x + Math.round(vGrid * 1.5) - x,
			sink.y + Math.round(hGrid * 2.5) - y,
			sourceBlock.x + Math.round(sourceBlock.width - vGrid * 1.5) - x,
			sourceBlock.y + Math.round(hGrid * 3.5) - y,
		]);
	});

	it.each(['root', 'group'])(
		'keeps wires on the active same-named output after selection changes in a %s',
		async scope => {
			const body = `module source
; @pos 20 2
float output 1
moduleEnd
module source
; @pos 60 2
float output 2
moduleEnd
module sink
; @pos 2 20
float* input &source:output
moduleEnd`;
			const text =
				scope === 'group'
					? `8f4e/v1\nentry main\ngroup voice\nentry main\n${body}\nentryEnd\ngroupEnd\nentryEnd`
					: `8f4e/v1\nentry main\n${body}\nentryEnd`;
			const { state, events, memoryViews, readConnections } = await setup(text);
			if (scope === 'group') {
				events.dispatch('openProjectGroup', {
					codeBlock: state.codeBlockRendering.rootProject.blocks.find(block => block.childProject),
				});
			}
			events.dispatch('enterEditMode');
			const sources = state.codeBlockRendering.currentProject.blocks.filter(block => block.name === 'source');
			const [inactive, active] = sources;
			const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
			const moduleId = scope === 'group' ? 'voice/source' : 'source';
			expect(state.compiler.result.compiledModules[moduleId].ast.projectBlockId).toBe(active.creationIndex);
			const onInputChanged = vi.fn();
			events.on('compilationInputChanged', onInputChanged);
			const expectActiveWire = () => {
				const endpoints = readConnections();
				expect(endpoints).toHaveLength(1);
				expect(endpoints[0][2]).toBe(
					active.x + Math.round(active.width - state.viewport.vGrid * 1.5) - state.viewport.x
				);
			};
			expectActiveWire();
			for (const block of [inactive, active, sink, inactive, active]) {
				events.dispatch('pointerdown', {
					x: block.x - state.viewport.x + 1,
					y: block.y - state.viewport.y + 1,
					movementX: 0,
					movementY: 0,
					buttons: 1,
					stopPropagation: false,
					canvasWidth: 800,
					canvasHeight: 600,
					altKey: false,
				});
				events.dispatch('pointerup');
				expectActiveWire();
			}
			expect(onInputChanged).not.toHaveBeenCalled();
			const output = state.compiler.result.memoryPlan.modules[moduleId].memory.output;
			expect(memoryViews.float32[output.allocationUnitAddress]).toBe(2);
		}
	);

	it('resolves inputs only for the active same-named module', async () => {
		const { state, readConnections } = await setup(`8f4e/v1
entry main
module source
; @pos 60 2
float output 2
moduleEnd
module sink
; @pos 2 2
float* input &source:output
moduleEnd
module sink
; @pos 2 20
float* input &source:output
moduleEnd
entryEnd`);
		const active = state.codeBlockRendering.currentProject.blocks.find(
			block => block.creationIndex === state.compiler.result.compiledModules.sink.ast.projectBlockId
		)!;
		const endpoints = readConnections();
		expect(endpoints).toHaveLength(1);
		expect(endpoints[0][0]).toBe(active.x + Math.round(state.viewport.vGrid * 1.5) - state.viewport.x);
	});

	it('removes obsolete outputs when blocks are deleted or the project is replaced', async () => {
		const { state, store, events, readConnections } = await setup(source, false);
		expect(readConnections()).toHaveLength(1);
		deleteCodeBlocks(store, [state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'source')!]);
		expect(readConnections()).toHaveLength(0);
		events.dispatch('loadProject', { project: parseProjectSource(source) });
		expect(readConnections()).toHaveLength(1);
		events.dispatch('loadProject', { project: parseProjectSource('8f4e/v1\nentry main\nentryEnd') });
		expect(readConnections()).toHaveLength(0);
	});

	it('rebinds geometry and the output index when compilation changes memory addresses', async () => {
		const test = await setup(source, false);
		const { state, store, memoryViews, readConnections } = test;
		const previousAddress = state.compiler.result.memoryPlan.modules.source.memory.output.byteAddress;
		const block = state.codeBlockRendering.currentProject.blocks.find(item => item.name === 'source')!;
		applyCodeBlockSourceEdits(test, [
			{ codeBlock: block, code: [...block.code.slice(0, 2), 'float _padding 0', ...block.code.slice(2)] },
		]);
		store.set('compiler.isCompiling', true);
		const result = await compileProject(serializeProjectLevel(state.codeBlockRendering.rootProject));
		store.set('compiler.result', {
			...state.compiler.result,
			compiledModules: result.compiledModules,
			memoryPlan: result.memoryPlan,
			memoryDefaultsByModuleId: result.memoryDefaultsByModuleId,
		});
		store.set('compiler.isCompiling', false);
		const { source: compiledSource, sink } = result.memoryPlan.modules;
		const outputAddress = compiledSource.memory.output.byteAddress;
		expect(outputAddress).not.toBe(previousAddress);
		memoryViews.int32[sink.memory.input.allocationUnitAddress] = previousAddress;
		expect(readConnections()).toHaveLength(0);
		memoryViews.int32[sink.memory.input.allocationUnitAddress] = outputAddress;
		expect(readConnections()).toHaveLength(1);
	});

	it.each(['inline', 'template'])(
		'resolves %s group exposures and rebuilds the index while navigating between project slices',
		async kind => {
			const contents = `entry main
module source
float value 1
moduleEnd
module innerSink
float* input &source:value
moduleEnd
entryEnd`;
			const definition = kind === 'template' ? `template voice\n${contents}\ntemplateEnd\n` : '';
			const { state, events, readConnections } = await setup(`8f4e/v1
${definition}entry main
group patch
expose output &source:value
${kind === 'template' ? 'useTemplate voice' : contents}
groupEnd
module outerSink
float* input &patch:output
moduleEnd
entryEnd`);
			const root = state.codeBlockRendering.currentProject.blocks;
			const group = root.find(block => block.name === 'patch')!;
			const outerSink = root.find(block => block.name === 'outerSink')!;
			const nested = group.childProject!.blocks;
			const innerSink = nested.find(block => block.name === 'innerSink')!;
			const innerSource = nested.find(block => block.name === 'source')!;
			const expectConnection = (input: CodeBlockGraphicData, output: CodeBlockGraphicData) => {
				// Each fixture declaration is on its block's second source row.
				const { vGrid, hGrid, x, y } = state.viewport;
				expect(readConnections().map(call => call.slice(0, 4))).toEqual([
					[
						input.x + vGrid * 1.5 - x,
						input.y + hGrid * 1.5 - y,
						output.x + output.width - vGrid * 1.5 - x,
						output.y + hGrid * 1.5 - y,
					],
				]);
			};
			expectConnection(outerSink, group);
			events.dispatch('openProjectGroup', { codeBlock: group });
			expectConnection(innerSink, innerSource);
			events.dispatch('goToParentProjectGroup');
			expectConnection(outerSink, group);
		}
	);
});
