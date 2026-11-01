import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

describe('resolved call signatures', () => {
	it('preserves overload names, expanded parameters, imports, entry calls, and function calls on source lines', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
entry main
module caller
int value
float factor
call convert 1
drop
push 1.0
call convert
drop
call inspect &value
call expanded 3 &value &factor 0.5
call split 7
drop
drop
call noop
call init
moduleEnd
entryEnd
entry init
entryEnd
prototype state
int left
float right
prototypeEnd
function convert
param int integer
push integer
functionEnd int
function convert
param float decimal
push decimal
functionEnd float
function inspect
#import inspect
param int* address
functionEnd
function expanded
param int before
paramShape state
param float after
functionEnd
function split
param int input
push input
push 1.0
functionEnd int float
function noop
call convert 2
drop
functionEnd
`),
			{ disableSharedMemory: true, includeStackAnalysis: true }
		);
		const calls = result.compiledModules.caller.stackAnalysis!.filter(line => line.instruction === 'call');
		expect(calls.map(line => line.resolvedCall)).toEqual([
			{
				targetFunctionId: createFunctionId('convert', ['int']),
				signature: { parameters: [{ name: 'integer', type: 'int' }], returns: ['int'] },
			},
			{
				targetFunctionId: createFunctionId('convert', ['float']),
				signature: { parameters: [{ name: 'decimal', type: 'float' }], returns: ['float'] },
			},
			{
				targetFunctionId: createFunctionId('inspect', ['int*']),
				signature: { parameters: [{ name: 'address', type: 'int*' }], returns: [] },
			},
			{
				targetFunctionId: createFunctionId('expanded', ['int', 'int*', 'float*', 'float']),
				signature: {
					parameters: [
						{ name: 'before', type: 'int' },
						{ name: 'left', type: 'int*' },
						{ name: 'right', type: 'float*' },
						{ name: 'after', type: 'float' },
					],
					returns: [],
				},
			},
			{
				targetFunctionId: createFunctionId('split', ['int']),
				signature: { parameters: [{ name: 'input', type: 'int' }], returns: ['int', 'float'] },
			},
			{ targetFunctionId: createFunctionId('noop', []), signature: { parameters: [], returns: [] } },
			{ targetFunctionId: createFunctionId('init', []), signature: { parameters: [], returns: [] } },
		]);
		expect(result.compiledFunctions![createFunctionId('noop', [])].stackAnalysis![0].resolvedCall).toEqual(
			calls[0].resolvedCall
		);
		expect(calls[0].stackAnalysis.consumedOperands).toEqual([]);
		expect(
			result.compiledModules.caller
				.stackAnalysis!.filter(line => line.instruction !== 'call')
				.every(line => line.resolvedCall === undefined)
		).toBe(true);
	});
});
