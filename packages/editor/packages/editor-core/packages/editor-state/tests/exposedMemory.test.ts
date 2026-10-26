import { readFileSync } from 'node:fs';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectObjectModel } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crossfade from '~/features/code-blocks/features/directives/crossfade/interaction';
import {
	deriveDirectiveState,
	runBeforeGraphicDataWidthCalculation,
	runBlockLayoutReady,
} from '~/features/code-blocks/features/directives/registry';
import updateInputs from '~/features/code-blocks/features/inputs/updateGraphicData';
import updateOutputs from '~/features/code-blocks/features/outputs/updateGraphicData';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import resolveMemoryTarget from '~/pureHelpers/resolveMemoryTarget';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';

const source = readFileSync(new URL('./fixtures/exposed-controls.8f4e', import.meta.url), 'utf8');

function createBlocks(project: ProjectObjectModel, projectPath = ''): CodeBlockGraphicData[] {
	return [
		...project.modules.map(block => createMockCodeBlock({ code: block.code, projectPath, blockType: 'module' })),
		...project.groups.map(group =>
			createMockCodeBlock({
				name: group.name,
				code: group.code,
				projectPath,
				nestedProjectCodeBlocks: createBlocks(group, createChildProjectGroupPath(projectPath, group.name)),
			})
		),
	];
}

async function setup() {
	const project = parseProjectSource(source);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const state = createMockState();
	state.compiler.memoryPlan = compiled.memoryPlan;
	state.compiler.projectMemoryExposuresByGroupPath = compiled.projectMemoryExposuresByGroupPath;
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const int32 = new Int32Array(memory.buffer);
	const float32 = new Float32Array(memory.buffer);
	state.callbacks.getWordFromMemory = address => int32[address];
	state.callbacks.setWordInMemory = (address, value, isInteger) => {
		if (isInteger) int32[address] = value;
		else float32[address] = value;
	};
	state.codeBlockRendering.rootCodeBlocks = createBlocks(project);
	state.codeBlockRendering.codeBlocks = state.codeBlockRendering.rootCodeBlocks;
	const audio = state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'audio')!;
	const controls = state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'controls')!;
	const store = createStateManager(state);
	const events = createMockEventDispatcherWithVitest();
	events.dispatch = (name, payload) => {
		for (const [eventName, handler] of vi.mocked(events.on).mock.calls) {
			if (eventName === name) handler(payload);
		}
	};
	const derive = (block: CodeBlockGraphicData) => {
		const directives = deriveDirectiveState(block.code, block.parsedDirectives);
		runBeforeGraphicDataWidthCalculation(block, state, directives);
		runBlockLayoutReady(block, state, directives);
	};
	derive(audio);
	derive(controls);
	return { state, audio, controls, store, events, int32, float32, derive };
}

describe('shared exposed memory resolution', () => {
	let test: Awaited<ReturnType<typeof setup>>;
	beforeEach(async () => {
		test = await setup();
	});
	afterEach(() => test?.store.dispose());

	it('preserves public identity and resolves local, external, and direct references to the same storage', () => {
		const { state, audio, controls } = test;
		const local = resolveMemoryTarget(state, getCodeBlockMemoryScope(audio), 'gain')!;
		expect(local).toMatchObject({
			publicModuleId: 'audio',
			publicName: 'gain',
			moduleId: 'audio/voice',
			exposure: { name: 'gain', targetMemory: { type: 'float' } },
		});
		expect(local.memory.isInteger).toBe(false);
		expect(resolveMemoryTarget(state, getCodeBlockMemoryScope(controls), 'audio:gain')?.memory).toBe(local.memory);
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, 'audio/voice:level')?.memory).toBe(
			local.memory
		);
		expect(resolveMemoryIdentifier(state, getCodeBlockMemoryScope(audio), '&gain')?.memory).toBe(local.memory);
	});

	it('resolves nested and sibling namespaces without searching unrelated scopes', () => {
		const { state, audio } = test;
		const nested = audio.nestedProjectCodeBlocks!.find(block => block.name === 'nested')!;
		expect(resolveMemoryTarget(state, getCodeBlockMemoryScope(audio), 'nested:gain')?.moduleId).toBe(
			'audio/nested/voice'
		);
		expect(resolveMemoryTarget(state, getCodeBlockMemoryScope(nested), 'gain')?.moduleId).toBe('audio/nested/voice');
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, 'audio/nested:gain')?.memory.isInteger).toBe(
			true
		);
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, 'other:gain')?.moduleId).toBe('other/voice');
		expect(resolveMemoryTarget(state, getCodeBlockMemoryScope(nested), 'wet')).toBeUndefined();
	});

	it('dereferences an exposed pointer to its backing declaration', () => {
		const { state, audio } = test;
		const scope = getCodeBlockMemoryScope(audio);
		const target = resolveMemoryTarget(state, scope, 'gain')!.memory;
		expect(resolveMemoryIdentifier(state, scope, '*input')?.memory).toBe(target);
	});

	it('shares backing addresses between memory displays and connectors', () => {
		const { state, audio } = test;
		updateInputs(audio, state);
		updateOutputs(audio, state);
		const gain = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(audio), '&gain')!.memory;
		expect(audio.widgets.debuggers[0].memory?.allocationUnitAddress).toBe(gain.allocationUnitAddress);
		expect(audio.widgets.outputs.find(output => output.id === 'gain')?.memory.allocationUnitAddress).toBe(
			gain.allocationUnitAddress
		);
		expect(audio.widgets.inputs.map(input => input.id)).toEqual(['input']);
		expect(audio.widgets.outputs.map(output => output.id)).toContain('gateAlias');
		expect(audio.widgets.arrayPlotters[0].length).toBe(4);
		expect(audio.widgets.arrayBars[0].length).toBe(4);
		expect(audio.widgets.arrayMeters[0].memory.memory.allocationUnitAddress).toBe(gain.allocationUnitAddress);
	});

	it('writes crossfade values to the resolved backing memory', () => {
		const { audio, store, events, float32 } = test;
		const cleanupCrossfade = crossfade(store, events);
		const widget = audio.widgets.crossfades[0];
		events.dispatch('codeBlockPointerDown', {
			codeBlock: audio,
			x: audio.x + widget.x + widget.handleWidth / 2,
			y: audio.y + widget.y + 1,
		});
		expect(float32[widget.leftWordAddress]).toBe(1);
		expect(float32[widget.rightWordAddress]).toBe(0);
		cleanupCrossfade();
	});

	it('rebinds controls to replacement metadata and removes unresolved aliases', () => {
		const { state, audio, derive } = test;
		const replacement = {
			...state.compiler.projectMemoryExposuresByGroupPath.audio[0],
			targetModuleId: 'other/voice',
			targetMemory: state.compiler.memoryPlan.modules['other/voice'].memory.level,
		};
		state.compiler.projectMemoryExposuresByGroupPath = { audio: [replacement] };
		derive(audio);
		expect(resolveMemoryTarget(state, getCodeBlockMemoryScope(audio), 'gain')?.memory).toBe(replacement.targetMemory);
		expect(audio.widgets.debuggers[0].memory?.allocationUnitAddress).toBe(
			replacement.targetMemory.allocationUnitAddress
		);
		state.compiler.projectMemoryExposuresByGroupPath = {};
		derive(audio);
		expect(audio.widgets.debuggers).toEqual([]);
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, 'audio:gain')).toBeUndefined();
	});
});
