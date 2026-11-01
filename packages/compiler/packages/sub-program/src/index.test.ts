import type { ProjectObjectModel } from '@8f4e/language-spec';
import { composeProgram } from '@8f4e/program-composer/internal';
import { describe, expect, it } from 'vitest';
import { compileSubProgram } from '.';

const emptyProject: ProjectObjectModel = {
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
	it('compiles one closed source unit into emission-ready artifacts', () => {
		const compiled = compileSubProgram(composeProgram(emptyProject), { disableSharedMemory: true });

		expect(compiled.entryNames).toEqual(['main']);
		expect(compiled.compiledModules).toEqual([]);
		expect(compiled.compiledFunctions).toEqual([]);
		expect(compiled.memoryPlan.moduleList).toEqual([]);
		expect(compiled.functionLayout.imports).toEqual([]);
	});
});
