import type { EnsureNonZeroLine, StackValueType } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

interface Case {
	name: string;
	type: StackValueType;
	input?: number;
	inputNonzero?: boolean;
	fallback?: number;
	nonzero: boolean;
}

const cases: Case[] = [
	{ name: 'default fallback for an unknown integer', type: 'int', nonzero: true },
	{ name: 'default fallback for known zero', type: 'int', input: 0, nonzero: true },
	{ name: 'wrapped integer fallback', type: 'int', input: 0, fallback: 4294967296, nonzero: false },
	{ name: 'wrapped fallback with unknown input', type: 'int', fallback: 4294967296, nonzero: false },
	{ name: 'unused wrapped fallback', type: 'int', input: 7, fallback: 4294967296, nonzero: true },
	{ name: 'proven nonzero input', type: 'int', inputNonzero: true, fallback: 4294967296, nonzero: true },
	{ name: 'underflowed float32 fallback', type: 'float', input: 0, fallback: 1e-50, nonzero: false },
	{ name: 'underflowed fallback with unknown input', type: 'float', fallback: 1e-50, nonzero: false },
	{
		name: 'representable float64 fallback',
		type: 'float64',
		input: 0,
		fallback: 1e-50,
		nonzero: true,
	},
];

describe('ensureNonZero facts', () => {
	it.each(cases)('$name', ({ type, input, inputNonzero, fallback, nonzero }) => {
		const context = createStackAnalyzerTestContext({
			stack: [
				{
					kind: 'value',
					valueType: type,
					isNonZero: input === undefined ? !!inputNonzero : input !== 0,
					...(input !== undefined ? { knownValue: input } : {}),
				},
			],
		});
		const line: EnsureNonZeroLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 1,
			instruction: 'ensureNonZero',
			arguments:
				fallback === undefined
					? []
					: [{ type: ArgumentType.LITERAL, value: fallback, isInteger: Number.isInteger(fallback) }],
		};
		analyzeInstruction(line, context);
		expect(context.stack).toEqual([
			{
				kind: 'value',
				valueType: type,
				isNonZero: nonzero,
			},
		]);
	});
});
