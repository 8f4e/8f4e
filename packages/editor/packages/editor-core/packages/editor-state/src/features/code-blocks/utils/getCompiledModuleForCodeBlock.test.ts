import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { createProjectModuleId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { getCompiledModuleForCodeBlock, getModuleCompilationForCodeBlock } from './getCompiledModuleForCodeBlock';

describe('source module compilation lookup', () => {
	it.each(['', 'voice'])('resolves only the selected source block in project path %s', projectPath => {
		const id = createProjectModuleId(projectPath, 'source');
		const state = createMockState({
			compiler: {
				result: {
					compiledModules: { [id]: { id, ast: { projectBlockId: 2 } } },
					memoryPlan: { modules: { [id]: { id, memory: {} } } },
					memoryDefaultsByModuleId: { [id]: {} },
				},
			},
		});
		const active = createMockCodeBlock({ name: 'source', projectPath, creationIndex: 2, blockType: 'module' });
		const inactive = createMockCodeBlock({ name: 'source', projectPath, creationIndex: 1, blockType: 'module' });
		expect(getCompiledModuleForCodeBlock(active, state)).toBe(state.compiler.result.compiledModules[id]);
		expect(getModuleCompilationForCodeBlock(active, state)).toEqual({
			compiledModule: state.compiler.result.compiledModules[id],
			plannedModule: state.compiler.result.memoryPlan.modules[id],
			memoryDefaults: state.compiler.result.memoryDefaultsByModuleId[id],
		});
		expect(getCompiledModuleForCodeBlock(inactive, state)).toBeUndefined();
		expect(getModuleCompilationForCodeBlock(inactive, state)).toBeUndefined();

		state.compiler.result.compiledModules = {
			[id]: {
				...state.compiler.result.compiledModules[id],
				ast: {
					...state.compiler.result.compiledModules[id].ast,
					projectBlockId: 1,
				},
			},
		};
		expect(getCompiledModuleForCodeBlock(active, state)).toBeUndefined();
		expect(getCompiledModuleForCodeBlock(inactive, state)).toBe(state.compiler.result.compiledModules[id]);
	});

	it('distinguishes unavailable metadata from incomplete memory reports', () => {
		const block = createMockCodeBlock();
		const state = createMockState();
		expect(getCompiledModuleForCodeBlock(block, state)).toBeUndefined();
		expect(getModuleCompilationForCodeBlock(block, state)).toBeUndefined();
		state.compiler.result.compiledModules = createMockState({
			compiler: {
				result: {
					compiledModules: { 'test-block': { id: 'test-block', ast: { projectBlockId: 0 } } },
				},
			},
		}).compiler.result.compiledModules;
		expect(getCompiledModuleForCodeBlock(block, state)).toBeDefined();
		expect(getModuleCompilationForCodeBlock(block, state)).toBeUndefined();
		state.compiler.result.memoryPlan = createMockState({
			compiler: {
				result: {
					memoryPlan: { modules: { 'test-block': { id: 'test-block', memory: {} } } },
				},
			},
		}).compiler.result.memoryPlan;
		expect(getModuleCompilationForCodeBlock(block, state)).toBeUndefined();
		state.compiler.result.memoryDefaultsByModuleId['test-block'] = {};
		expect(getModuleCompilationForCodeBlock(block, state)).toBeDefined();
	});
});
