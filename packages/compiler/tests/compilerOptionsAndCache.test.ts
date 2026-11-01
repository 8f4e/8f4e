import { createFunctionId, isMemoryDeclarationLine } from '@8f4e/language-spec';
import { describe, expect, test } from 'vitest';

import { compileProject, parseProjectSource } from '../src';
import { compileFixtureProgramSource, createMemory, getExportedFunction } from './testUtils';

describe('compiler options and cache', () => {
	test('always exposes AST and exposes stack analysis only when requested', async () => {
		const source = `
8f4e/v1

entry main
module optionSurface
int output
push &output
push 1
store
moduleEnd
entryEnd

function double
param int value
push value
push value
add
functionEnd int
`;
		const defaultResult = (await compileFixtureProgramSource(source)).compileResult;
		const analyzedResult = (
			await compileFixtureProgramSource(source, {
				includeStackAnalysis: true,
			})
		).compileResult;
		const functionId = createFunctionId('double', ['int']);

		expect(defaultResult.compiledModules.optionSurface.ast.id).toBe('optionSurface');
		expect(defaultResult.compiledModules.optionSurface.stackAnalysis).toBeUndefined();
		expect(defaultResult.compiledFunctions![functionId].stackAnalysis).toBeUndefined();

		expect(analyzedResult.compiledModules.optionSurface.ast.id).toBe('optionSurface');
		expect(analyzedResult.compiledModules.optionSurface.stackAnalysis?.map(line => line.instruction)).toEqual([
			'push',
			'push',
			'store',
		]);
		expect(analyzedResult.compiledFunctions![functionId].stackAnalysis?.map(line => line.instruction)).toEqual([
			'push',
			'push',
			'add',
			'functionEnd',
		]);
	});

	test('exposes resolved float constant values in stack analysis', async () => {
		const source = `
8f4e/v1

entry main
module floatConstants
use values
push FLOAT32
push 2.0
div
drop
push FLOAT64
push 2f64
div
drop
moduleEnd
entryEnd

constants values
const FLOAT32 3.141592653589793
const FLOAT64 3.141592653589793f64
constantsEnd
`;
		const result = (
			await compileFixtureProgramSource(source, {
				includeStackAnalysis: true,
			})
		).compileResult;
		const pushLines = result.compiledModules.floatConstants.stackAnalysis?.filter(line => line.instruction === 'push');
		const divLines = result.compiledModules.floatConstants.stackAnalysis?.filter(line => line.instruction === 'div');

		expect(pushLines?.[0]?.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(Math.PI) },
		]);
		expect(pushLines?.[2]?.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float64', isNonZero: true, knownValue: Math.PI },
		]);
		expect(divLines?.[0]?.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(Math.fround(Math.PI) / 2) },
		]);
		expect(divLines?.[1]?.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float64', isNonZero: true, knownValue: Math.PI / 2 },
		]);
	});

	test('reuses cached AST entries when recompiling unchanged source', async () => {
		const source = `
8f4e/v1

entry main
module cachedModule
int value 1
moduleEnd
entryEnd

function cachedFunction
push 1
functionEnd int
`;
		const first = await compileFixtureProgramSource(source);
		const cachedModuleAst = first.compileResult.cache.ast.entries.get('root:entry:main:module:0')?.ast;
		const cachedFunctionAst = first.compileResult.cache.ast.entries.get('root:function:0')?.ast;
		const second = await compileFixtureProgramSource(source, {
			cache: first.compileResult.cache,
		});

		expect(second.compileResult.cache).toBe(first.compileResult.cache);
		expect(second.compileResult.cache.ast.entries.get('root:entry:main:module:0')?.ast).toBe(cachedModuleAst);
		expect(second.compileResult.cache.ast.entries.get('root:function:0')?.ast).toBe(cachedFunctionAst);
		expect(second.compileResult.cache.ast.stats.hits).toBeGreaterThanOrEqual(2);
	});

	test('recompiles an exported function after an in-place source edit', async () => {
		const project = parseProjectSource(`8f4e/v1
function example
#export
push 1
functionEnd int`);
		const first = await compileProject(project, { disableSharedMemory: true });
		project.functions[0]!.code[2] = 'push 2';
		const second = await compileProject(project, { disableSharedMemory: true, cache: first.cache });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(second.codeBuffer), {
			host: { memory: createMemory(second.requiredMemoryBytes) },
		});

		expect(getExportedFunction(instance.exports, 'example')()).toBe(2);
	});

	test('re-resolves constants when reusing an unchanged module AST from cache', async () => {
		const createSource = (size: number) => `
8f4e/v1

entry main
module cachedConstants
use config
int[] buffer SIZE
moduleEnd
entryEnd

constants config
const SIZE ${size}
constantsEnd
`;
		const first = await compileFixtureProgramSource(createSource(2));
		const cachedModuleAst = first.compileResult.cache.ast.entries.get('root:entry:main:module:0')?.ast;
		const second = await compileFixtureProgramSource(createSource(4), {
			cache: first.compileResult.cache,
		});

		expect(second.compileResult.cache.ast.entries.get('root:entry:main:module:0')?.ast).toBe(cachedModuleAst);
		expect(second.compileResult.memoryPlan.modules.cachedConstants!.memory.buffer!.numberOfElements).toBe(4);
		const cachedMemoryDeclaration = cachedModuleAst?.lines.find(isMemoryDeclarationLine);
		expect(cachedMemoryDeclaration?.arguments[1]).toEqual(expect.objectContaining({ value: 'SIZE' }));
	});

	test('re-resolves overrides after reordering constants blocks with a cached consumer', async () => {
		const project = parseProjectSource(`8f4e/v1
constants preset
const SIZE 2
const KEPT 7
constantsEnd

constants preset
const SIZE 4
const KEPT 9
constantsEnd

entry main
module consumer
use preset
int[] buffer SIZE
int kept KEPT
moduleEnd
entryEnd`);
		const first = await compileProject(project, { disableSharedMemory: true });
		const cachedModuleAst = first.cache.ast.entries.get('root:entry:main:module:0')?.ast;
		expect(first.memoryPlan.modules.consumer!.memory.buffer!.numberOfElements).toBe(4);

		project.constants.reverse();
		const reordered = await compileProject(project, { disableSharedMemory: true, cache: first.cache });
		expect(reordered.cache.ast.entries.get('root:entry:main:module:0')?.ast).toBe(cachedModuleAst);
		expect(reordered.memoryPlan.modules.consumer!.memory.buffer!.numberOfElements).toBe(2);
		expect(reordered.memoryDefaultsByModuleId.consumer!.kept!.value).toBe(7);
		expect(first.memoryPlan.modules.consumer!.memory.buffer!.numberOfElements).toBe(4);

		project.constants[1]!.disabled = true;
		const disabled = await compileProject(project, { disableSharedMemory: true, cache: reordered.cache });
		expect(disabled.memoryPlan.modules.consumer!.memory.buffer!.numberOfElements).toBe(4);
		expect(disabled.memoryDefaultsByModuleId.consumer!.kept!.value).toBe(9);
	});
});
