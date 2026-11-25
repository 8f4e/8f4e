import {
	createFunctionId,
	createProjectObjectModel,
	ErrorCode,
	MAX_FUNCTION_PARAMETERS,
	MAX_FUNCTION_RETURN_VALUES,
	type ProjectModuleBlock,
	type ProjectObjectModel,
} from '@8f4e/language-spec';
import { composeProgram } from '@8f4e/program-composer/internal';
import { describe, expect, it } from 'vitest';
import { compileSubProgram } from '.';

const emptyProject: ProjectObjectModel = {
	entries: [],
	execution: [],
	functions: [],
	constants: [],
	includes: [],
	notes: [],
	unknown: [],
};

describe('compileSubProgram', () => {
	it('reports a signature overflow at the first parameter beyond the limit', () => {
		const project = createProjectObjectModel();
		project.functions.push({
			id: 1,
			code: [
				'function helper',
				...Array.from({ length: MAX_FUNCTION_PARAMETERS + 1 }, (_, index) => `param int input${index}`),
				'functionEnd',
			],
		});

		expect(() => compileSubProgram(composeProgram(project), {})).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: ErrorCode.FUNCTION_SIGNATURE_OVERFLOW,
					instruction: 'param',
					location: { kind: 'block', projectBlockId: 1, projectGroupPath: '', lineNumber: MAX_FUNCTION_PARAMETERS + 1 },
				}),
			})
		);
	});

	it('reports a signature overflow on the function end when there are too many results', () => {
		const project = createProjectObjectModel();
		project.functions.push({
			id: 1,
			code: ['function helper', `functionEnd${' int'.repeat(MAX_FUNCTION_RETURN_VALUES + 1)}`],
		});
		expect(() => compileSubProgram(composeProgram(project), {})).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: ErrorCode.FUNCTION_SIGNATURE_OVERFLOW,
					instruction: 'functionEnd',
					location: { kind: 'block', projectBlockId: 1, projectGroupPath: '', lineNumber: 1 },
				}),
			})
		);
	});

	it('keeps compiled signatures detached from the cached source AST', () => {
		const project = createProjectObjectModel();
		project.functions.push({
			id: 1,
			code: [
				'function helper',
				'param float* source',
				'param float64 factor',
				'push source',
				'push factor',
				'functionEnd float* float64',
			],
		});
		const program = composeProgram(project);
		const functionId = createFunctionId('helper', ['float*', 'float64']);
		const first = compileSubProgram(program, {}).compiledFunctions![functionId];
		first.signature.parameters[0].name = 'edited';
		first.ast.signature.returns[0] = 'int';

		const next = compileSubProgram(composeProgram(project, program.cache), {}).compiledFunctions![functionId];
		expect(program.cache.ast.stats.hits).toBe(1);
		expect(next.signature).toEqual({
			parameters: [
				{ name: 'source', type: 'float*' },
				{ name: 'factor', type: 'float64' },
			],
			returns: ['float*', 'float64'],
		});
	});

	it("retains each module's entry ownership when composed modules are reordered", () => {
		const module = (id: number, name: string, entry: string): ProjectModuleBlock => ({
			type: 'module',
			id,
			entry,
			code: [`module ${name}`, 'moduleEnd'],
		});
		const project: ProjectObjectModel = {
			...createProjectObjectModel(),
			entries: ['main', 'alternate'],
			execution: [
				module(1, 'rootFirst', 'main'),
				{
					...createProjectObjectModel(),
					type: 'group',
					id: 2,
					name: 'synth',
					entry: 'alternate',
					code: ['group synth', 'groupEnd'],
					exposures: [],
					entries: ['main', 'gate'],
					execution: [module(3, 'voice', 'main'), module(4, 'calculate', 'gate')],
				},
				module(5, 'rootLast', 'alternate'),
			],
		};
		const program = composeProgram(project);
		program.ast.modules.reverse();
		const compiled = compileSubProgram(program, {});

		expect(
			Object.values(compiled.compiledModules).map(({ id, executionEntryName }) => [id, executionEntryName])
		).toEqual([
			['rootLast', 'alternate'],
			['synth/calculate', 'synth/gate'],
			['synth/voice', 'synth/main'],
			['rootFirst', 'main'],
		]);
	});

	it('emits the host memory import and default exports for an empty source unit', () => {
		const compiled = compileSubProgram(composeProgram(emptyProject), {});
		const wasm = new WebAssembly.Module(new Uint8Array(compiled.codeBuffer));

		expect(WebAssembly.Module.imports(wasm)).toEqual([{ module: 'host', name: 'memory', kind: 'memory' }]);
		expect(WebAssembly.Module.exports(wasm)).toEqual(
			expect.arrayContaining([
				{ name: 'initDefaults', kind: 'function' },
				{ name: 'main', kind: 'function' },
			])
		);
		expect(compiled.compiledModules).toEqual({});
		expect(compiled.compiledFunctions).toEqual({});
		expect(compiled.memoryPlan.moduleList).toEqual([]);
	});
});
