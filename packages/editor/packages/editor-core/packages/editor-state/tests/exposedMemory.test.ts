import { readFileSync } from 'node:fs';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import {
	createChildProjectGroupPath,
	getProjectGroups,
	getProjectModules,
	type ProjectObjectModel,
} from '@8f4e/language-spec';
import { beforeEach, describe, expect, it } from 'vitest';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryIdentifier from '~/pureHelpers/resolveMemoryIdentifier';
import resolveMemoryTarget from '~/pureHelpers/resolveMemoryTarget';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';

const source = readFileSync(new URL('./fixtures/exposed-controls.8f4e', import.meta.url), 'utf8');

function createBlocks(project: ProjectObjectModel, projectPath = ''): CodeBlockGraphicData[] {
	return [
		...getProjectModules(project).map(block =>
			createMockCodeBlock({ code: block.code, projectPath, blockType: 'module' })
		),
		...getProjectGroups(project).map(group =>
			createMockCodeBlock({
				name: group.name,
				code: group.code,
				projectPath,
				childProject: { path: '', blocks: createBlocks(group, createChildProjectGroupPath(projectPath, group.name)) },
			})
		),
	];
}

async function setup() {
	const project = parseProjectSource(source);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const state = createMockState();
	state.compiler.result.memoryPlan = compiled.memoryPlan;
	state.compiler.result.projectMemoryExposuresByGroupPath = compiled.projectMemoryExposuresByGroupPath;
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const int32 = new Int32Array(memory.buffer);
	state.callbacks.getWordFromMemory = address => int32[address];
	state.codeBlockRendering.rootProject.blocks = createBlocks(project);
	state.codeBlockRendering.currentProject.blocks = state.codeBlockRendering.rootProject.blocks;
	const audio = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'audio')!;
	const controls = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'controls')!;
	return { state, audio, controls };
}

describe('shared exposed memory resolution', () => {
	let test: Awaited<ReturnType<typeof setup>>;
	beforeEach(async () => {
		test = await setup();
	});

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
		const nested = audio.childProject!.blocks.find(block => block.name === 'nested')!;
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

	it('rebinds controls to replacement metadata and removes unresolved aliases', () => {
		const { state, audio } = test;
		const replacement = {
			...state.compiler.result.projectMemoryExposuresByGroupPath.audio[0],
			targetModuleId: 'other/voice',
			targetMemory: state.compiler.result.memoryPlan.modules['other/voice'].memory.level,
		};
		state.compiler.result.projectMemoryExposuresByGroupPath = { audio: [replacement] };
		expect(resolveMemoryTarget(state, getCodeBlockMemoryScope(audio), 'gain')?.memory).toBe(replacement.targetMemory);
		state.compiler.result.projectMemoryExposuresByGroupPath = {};
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, 'audio:gain')).toBeUndefined();
	});
});
