import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

const line: CompilerASTLine = {
	diagnosticSource: { kind: 'document' },
	lineNumber: 1,
	instruction: 'castToInt',
	arguments: [],
};

describe.each(['float', 'float64'] as const)('castToInt %s facts', valueType => {
	it('cannot infer a nonzero integer from an unknown nonzero float', () => {
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType, isNonZero: true }],
		});
		analyzeInstruction(line, context);
		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false }]);
	});

	it.each([
		[0.5, 0],
		[-0.5, 0],
		[2.5, 2],
		[-2.5, -2],
		[Number.NaN, 0],
		[Number.POSITIVE_INFINITY, 2147483647],
		[Number.NEGATIVE_INFINITY, -2147483648],
		[2147483648, 2147483647],
		[-2147483649, -2147483648],
	])('converts known %s to signed integer %s', (value, expected) => {
		const knownValue = valueType === 'float' ? Math.fround(value) : value;
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType, isNonZero: knownValue !== 0, knownValue }],
		});
		analyzeInstruction(line, context);
		expect(context.stack).toEqual([
			{ kind: 'value', valueType: 'int', isNonZero: expected !== 0, knownValue: expected },
		]);
	});
});
