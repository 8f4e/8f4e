import { type CompilerCache, createFunctionId } from '@8f4e/language-spec';
import { describe, expect, test } from 'vitest';

import { compileProject, parseProjectSource } from '../src';
import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

describe('function override metadata', () => {
	test('updates the winner when declarations move or become disabled with a reused cache', async () => {
		const project = parseProjectSource(`8f4e/v1
function selected
#export
push 1
functionEnd int

function selected
#export
push 2
functionEnd int
`);
		let cache: CompilerCache | undefined;
		const selectedValue = async () => {
			const saved = structuredClone(project);
			const compiled = await compileProject(project, {}, cache);
			cache = compiled.cache;
			const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
			const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });

			expect(project).toEqual(saved);
			return getExportedFunction(instance.exports, 'selected')();
		};

		expect(await selectedValue()).toBe(2);
		project.functions.reverse();
		expect(await selectedValue()).toBe(1);
		project.functions[1].disabled = true;
		expect(await selectedValue()).toBe(2);
	});

	test('emits only the selected export and implementation', async () => {
		const fixture = await instantiateFixtureProgramSource(`8f4e/v1
function selected
#export main
push 1
functionEnd int

function selected
#export selectedValue
push 2.5
functionEnd float
`);

		expect(fixture.instance.exports.selected).toBeUndefined();
		expect(getExportedFunction(fixture.instance.exports, 'selectedValue')()).toBe(2.5);
		expect(fixture.compileResult.compiledFunctions![createFunctionId('selected', [])]).toMatchObject({
			exportName: 'selectedValue',
			signature: { parameters: [], returns: ['float'] },
		});
	});

	test('replaces host imports with bodies and bodies with host imports', async () => {
		const fixture = await instantiateFixtureProgramSource(
			`8f4e/v1
function localValue
#import obsoleteImport
functionEnd int

function localValue
#export
push 7
functionEnd int

function importedValue
#export obsoleteExport
push -1
functionEnd int

function importedValue
#import selectedImport
functionEnd int

function callImported
#impure
#export
call importedValue
functionEnd int
`,
			{ hostImports: { selectedImport: () => 9 } }
		);

		expect(getExportedFunction(fixture.instance.exports, 'localValue')()).toBe(7);
		expect(getExportedFunction(fixture.instance.exports, 'callImported')()).toBe(9);
		expect(fixture.instance.exports.obsoleteExport).toBeUndefined();
		expect(fixture.compileResult.compiledFunctions![createFunctionId('localValue', [])].import).toBeUndefined();
		expect(fixture.compileResult.compiledFunctions![createFunctionId('importedValue', [])].import).toEqual({
			moduleName: 'host',
			fieldName: 'selectedImport',
		});
	});
});
