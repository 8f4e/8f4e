import { createProjectObjectModel, type ProjectModuleBlock, type ProjectObjectModel } from '@8f4e/language-spec';
import { composeProgram } from '@8f4e/program-composer/internal';
import { describe, expect, it } from 'vitest';
import { compileSubProgram } from '.';

const emptyProject: ProjectObjectModel = {
	entries: [],
	code: [],
	execution: [],
	functions: [],
	constants: [],
	prototypes: [],
	includes: [],
	notes: [],
	unknown: [],
};

describe('compileSubProgram', () => {
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
