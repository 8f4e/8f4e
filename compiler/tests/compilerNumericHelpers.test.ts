import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, test } from 'vitest';

import { compileFixtureProgramSource, getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

describe('numeric source helpers', () => {
	test('inline pointer operands emit the expanded operations and preserve source stack analysis', async () => {
		const source = `8f4e/v1
function scale
#export
#impure
param float value
param float* gain
push value
mul *gain
functionEnd float
`;
		const { compileResult: shorthand } = await compileFixtureProgramSource(source, { includeStackAnalysis: true });
		const { compileResult: expanded } = await compileFixtureProgramSource(
			source.replace('mul *gain', 'push *gain\nmul')
		);
		expect(shorthand.codeBuffer).toEqual(expanded.codeBuffer);
		const operation = shorthand.compiledFunctions![createFunctionId('scale', ['float', 'float*'])].stackAnalysis!.find(
			line => line.instruction === 'mul'
		)!;
		expect(operation.lineNumber).toBe(6);
		expect(operation.stackAnalysis.stackBefore).toHaveLength(1);
		expect(operation.stackAnalysis.stackAfter).toHaveLength(1);
		expect(operation.stackAnalysis.consumedOperands).toHaveLength(1);
		expect(operation.stackAnalysis.producedStackItems[0].valueType).toBe('float');
	});

	test('groups normalized operations by source without consuming unrelated source stack values', async () => {
		const { compileResult } = await compileFixtureProgramSource(
			`8f4e/v1
entry main
module operations
push 99
push 8
sub 3
call identity 4
clearStack
moduleEnd
entryEnd
function identity
param int value
push value
functionEnd int
`,
			{ includeStackAnalysis: true }
		);
		const analysis = compileResult.compiledModules.operations.stackAnalysis!;
		const subtract = analysis.find(line => line.instruction === 'sub')!.stackAnalysis;
		expect(subtract.stackBefore.map(value => value.knownValue)).toEqual([99, 8]);
		expect(subtract.stackAfter.map(value => value.knownValue)).toEqual([99, 5]);
		expect(subtract.consumedOperands.map(value => value.knownValue)).toEqual([8]);
		expect(subtract.producedStackItems.map(value => value.knownValue)).toEqual([5]);
		const call = analysis.find(line => line.instruction === 'call')!.stackAnalysis;
		expect(call.stackBefore.map(value => value.knownValue)).toEqual([99, 5]);
		expect(call.consumedOperands).toEqual([]);
		expect(call.producedStackItems).toHaveLength(1);
		expect(analysis.map(line => line.instruction)).toEqual(['push', 'push', 'sub', 'call', 'clearStack']);
	});

	test('exp2 stays monotonic and within its measured relative error across the supported range', async () => {
		const { instance } = await instantiateFixtureProgramSource(`8f4e/v1
includes
include std/math/exp2
includesEnd
function evaluate
#export
param float x
push x
call exp2
functionEnd float
`);
		const evaluate = getExportedFunction(instance.exports, 'evaluate');
		let maximumRelativeError = 0;
		let monotonic = true;
		let previous = 0;
		for (let index = 0; index <= 30 * 4096; index++) {
			const x = -24 + index / 4096;
			const actual = evaluate(x) as number;
			maximumRelativeError = Math.max(maximumRelativeError, Math.abs(actual / 2 ** x - 1));
			monotonic &&= actual >= previous;
			previous = actual;
		}
		expect(maximumRelativeError).toBeLessThan(3e-7);
		expect(monotonic).toBe(true);
	});
});
