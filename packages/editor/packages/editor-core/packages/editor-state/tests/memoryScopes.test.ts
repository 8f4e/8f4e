import { readFileSync } from 'node:fs';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { beforeAll, describe, expect, it } from 'vitest';
import resolveMemoryTarget, { type MemoryScope } from '~/pureHelpers/resolveMemoryTarget';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';

const source = readFileSync(new URL('./fixtures/memory-scopes.8f4e', import.meta.url), 'utf8');

describe('explicit memory scopes', () => {
	let state: Parameters<typeof resolveMemoryTarget>[0];
	const moduleScope: MemoryScope = { kind: 'module', moduleId: 'audio' };
	const projectScope: MemoryScope = { kind: 'project', groupPath: 'audio' };
	const rootScope: MemoryScope = { kind: 'project', groupPath: '' };

	beforeAll(async () => {
		const compiled = await compileProject(parseProjectSource(source), { disableSharedMemory: true });
		state = createMockState();
		state.compiler.result.memoryPlan = compiled.memoryPlan;
		state.compiler.result.projectMemoryExposuresByGroupPath = compiled.projectMemoryExposuresByGroupPath;
	});

	it('keeps local declarations and exposed aliases separate when a module and group share a name', () => {
		expect(resolveMemoryTarget(state, moduleScope, 'gain')?.memory).toBe(
			state.compiler.result.memoryPlan.modules.audio.memory.gain
		);
		expect(resolveMemoryTarget(state, projectScope, 'gain')).toMatchObject({
			publicModuleId: 'audio',
			publicName: 'gain',
			moduleId: 'audio/voice',
		});
		expect(resolveMemoryTarget(state, projectScope, 'hidden')).toBeUndefined();
		expect(resolveMemoryTarget(state, moduleScope, 'aliasOnly')).toBeUndefined();
		expect(resolveMemoryTarget(state, rootScope, 'gain')).toBeUndefined();
	});

	it('resolves qualified aliases and canonical backing references from the root project', () => {
		const backing = state.compiler.result.memoryPlan.modules['audio/voice'].memory.level;
		expect(resolveMemoryTarget(state, rootScope, 'audio:gain')?.memory).toBe(backing);
		expect(resolveMemoryTarget(state, rootScope, 'audio/voice:level')?.memory).toBe(backing);
		expect(resolveMemoryTarget(state, moduleScope, 'audio:gain')?.memory).toBe(backing);
	});

	it('resolves qualified names relative to project scopes and module owners', () => {
		const backing = state.compiler.result.memoryPlan.modules['audio/nested/voice'].memory.level;
		expect(resolveMemoryTarget(state, projectScope, 'nested:gain')?.memory).toBe(backing);
		expect(resolveMemoryTarget(state, { kind: 'module', moduleId: 'audio/voice' }, 'nested:gain')?.memory).toBe(
			backing
		);
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: 'audio/nested' }, 'gain')?.memory).toBe(backing);
		expect(resolveMemoryTarget(state, rootScope, 'audio/nested:gain')?.memory).toBe(backing);
		expect(resolveMemoryTarget(state, rootScope, 'nested:gain')).toBeUndefined();
	});
});
