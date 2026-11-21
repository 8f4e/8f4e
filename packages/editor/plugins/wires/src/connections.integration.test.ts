import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits, deleteCodeBlocks, serializeProjectLevel } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createRenderGeometry, type RenderGeometry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it } from 'vitest';
import { createWireConnections, type WireConnectionVisitor } from './connections';

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
});

async function setup(text = source) {
	const project = parseProjectSource(text);
	const compiled = await compileProject(project);
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const memoryViews = {
		int32: new Int32Array(memory.buffer),
	};
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: { getWordFromMemory: address => memoryViews.int32[address] } });
	const state = store.getState();
	Object.assign(state.compiler.result, {
		memoryPlan: compiled.memoryPlan,
		memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
		compiledModules: compiled.compiledModules,
		compiledFunctions: compiled.compiledFunctions,
		projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
	});
	const connections = createWireConnections(state, events);
	events.dispatch('loadProject', { project });
	const readConnections = (renderGeometry: RenderGeometry = createRenderGeometry(state)) => {
		const endpoints: Array<Parameters<WireConnectionVisitor>> = [];
		connections.visit(renderGeometry, memoryViews.int32, (...endpoint) => endpoints.push(endpoint));
		return endpoints;
	};
	cleanups.push(store.dispose, connections.dispose);
	return { store, state, events, memoryViews, readConnections };
}

describe('wire connections', () => {
	it('positions wire endpoints after another plugin adds rows', async () => {
		const { state, store, readConnections } = await setup();
		const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
		const { hGrid, y } = state.viewport;
		const contribution = store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(sink, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(readConnections()).toHaveLength(1);
		expect(readConnections()[0][1]).toBe(sink.y + Math.round(4.5 * hGrid) - y);
	});

	it('rounds wire anchors to whole pixels for odd font dimensions', async () => {
		const { state, events, readConnections } = await setup();
		state.viewport.vGrid = 9;
		state.viewport.hGrid = 17;
		events.dispatch('gridSizeChanged');
		const blocks = state.codeBlockRendering.currentProject.blocks;
		const sourceBlock = blocks.find(block => block.name === 'source')!;
		const sink = blocks.find(block => block.name === 'sink')!;
		const { x, y } = state.viewport;
		expect(readConnections()).toEqual([
			[sink.x + 14 - x, sink.y + 43 - y, sourceBlock.x + sourceBlock.width - 13 - x, sourceBlock.y + 43 - y, false],
		]);
	});

	it('resolves live pointer endpoints independently of block visibility', async () => {
		const { state, memoryViews, readConnections } = await setup();
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

	it('uses the rendered origins for both endpoints, including offscreen blocks', async () => {
		const { state, readConnections } = await setup();
		const sourceBlock = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'source')!;
		const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
		sourceBlock.x = -10000;
		const [original] = readConnections();
		const renderGeometry = createRenderGeometry(state);
		const blocks = renderGeometry.blocks.map(block =>
			block.codeBlock === sink
				? { ...block, x: block.x + 12, y: block.y + 20 }
				: { ...block, x: block.x - 35, y: block.y - 70 }
		);
		expect(
			readConnections({ blocks, blocksByCodeBlock: new Map(blocks.map(block => [block.codeBlock, block])) })
		).toEqual([[original[0] + 12, original[1] + 20, original[2] - 35, original[3] - 70, original[4]]]);
		expect(sourceBlock.x).toBe(-10000);
		expect(readConnections()).toEqual([original]);
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
			const { state, events, readConnections } = await setup(text);
			if (scope === 'group') {
				events.dispatch('openProjectGroup', {
					codeBlock: state.codeBlockRendering.rootProject.blocks.find(block => block.childProject),
				});
			}
			events.dispatch('enterEditMode');
			const sources = state.codeBlockRendering.currentProject.blocks.filter(block => block.name === 'source');
			const [inactive, active] = sources;
			const sink = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
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
		const { state, store, events, readConnections } = await setup();
		expect(readConnections()).toHaveLength(1);
		deleteCodeBlocks(store, [state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'source')!]);
		expect(readConnections()).toHaveLength(0);
		events.dispatch('loadProject', { project: parseProjectSource(source) });
		expect(readConnections()).toHaveLength(1);
		events.dispatch('loadProject', { project: parseProjectSource('8f4e/v1\nentry main\nentryEnd') });
		expect(readConnections()).toHaveLength(0);
	});

	it('rebinds geometry and the output index when compilation changes memory addresses', async () => {
		const test = await setup();
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
group patch${kind === 'template' ? ' use voice' : ''}
expose output &source:value
${kind === 'template' ? '' : contents + '\n'}groupEnd
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

	it('keeps the accepted target on its current exposure row during pending source edits', async () => {
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
module outerSink
float& input &patch:output
moduleEnd
entryEnd`);
		const { state, readConnections } = test;
		const group = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'patch')!;
		const outputY = () => readConnections().map(connection => connection[3] - group.y + state.viewport.y);
		const { hGrid } = state.viewport;
		expect(outputY()).toEqual([Math.round(1.5 * hGrid)]);

		applyCodeBlockSourceEdits(test, [{ codeBlock: group, code: [group.code[0], '', '', ...group.code.slice(1)] }]);
		expect(outputY()).toEqual([Math.round(3.5 * hGrid)]);

		applyCodeBlockSourceEdits(test, [
			{ codeBlock: group, code: group.code.filter(line => !line.startsWith('expose ')) },
		]);
		expect(outputY()).toEqual([]);
	});
});
