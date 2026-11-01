import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, test } from 'vitest';

import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

describe('compiler host imports', () => {
	test('supports custom host imports with side effects and return values', async () => {
		const calls: number[] = [];
		const fixture = await instantiateFixtureProgramSource(
			`
8f4e/v1

entry main
module hostImportCaller
int output

push 41
call record

push &output
push 41
call addOne
store
moduleEnd
entryEnd

function record
#import record
param int value
functionEnd

function addOne
#import "add.one"
param int value
functionEnd int
`,
			{
				hostImports: {
					record: (value: number) => calls.push(value),
					'add.one': (value: number) => value + 1,
				},
			}
		);
		const memory = fixture.host.memory as WebAssembly.Memory;
		const output = fixture.compileResult.memoryPlan.modules.hostImportCaller!.memory.output!.byteAddress;

		getExportedFunction(fixture.instance.exports, 'initDefaults')();
		getExportedFunction(fixture.instance.exports, 'main')();

		expect(calls).toEqual([41]);
		expect(new DataView(memory.buffer).getInt32(output, true)).toBe(42);
		expect(fixture.compileResult.compiledFunctions![createFunctionId('record', ['int'])].import).toEqual({
			moduleName: 'host',
			fieldName: 'record',
		});
		expect(fixture.compileResult.compiledFunctions![createFunctionId('addOne', ['int'])].import).toEqual({
			moduleName: 'host',
			fieldName: 'add.one',
		});
	});

	test('supports paramShape signatures on host imports', async () => {
		const calls: number[][] = [];
		const fixture = await instantiateFixtureProgramSource(
			`
8f4e/v1

prototype mixerState
int left 2
float right 1.5
prototypeEnd

entry main
module shapeImportCaller
shape mixerState

push &left
push &right
call recordShape
moduleEnd
entryEnd

function recordShape
#import recordShape
paramShape mixerState
functionEnd
`,
			{
				hostImports: {
					recordShape: (leftAddress: number, rightAddress: number) => calls.push([leftAddress, rightAddress]),
				},
			}
		);

		const memory = fixture.compileResult.memoryPlan.modules.shapeImportCaller!.memory;

		getExportedFunction(fixture.instance.exports, 'initDefaults')();
		getExportedFunction(fixture.instance.exports, 'main')();

		expect(calls).toEqual([[memory.left.byteAddress, memory.right.byteAddress]]);
		const functionId = createFunctionId('recordShape', ['int*', 'float*']);
		expect(fixture.compileResult.compiledFunctions![functionId].signature.parameters).toEqual(['int*', 'float*']);
		expect(fixture.compileResult.compiledFunctions![functionId].import).toEqual({
			moduleName: 'host',
			fieldName: 'recordShape',
		});
	});
});
