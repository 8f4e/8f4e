import type { CompilationContext, InstructionCompiler } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { validateOperandTypes } from './validateOperandTypes';

const line: Parameters<InstructionCompiler>[0] = {
	diagnosticSource: { kind: 'document' },
	lineNumber: 1,
	instruction: 'test' as never,
	arguments: [],
};
const context = { stack: [] } as unknown as CompilationContext;

describe('validateOperandTypes', () => {
	it('accepts valid scalar rules', () => {
		expect(() =>
			validateOperandTypes(
				[
					{ kind: 'value', valueType: 'int' },
					{ kind: 'value', valueType: 'int' },
				],
				'int',
				line,
				context
			)
		).not.toThrow();
		expect(() =>
			validateOperandTypes(
				[
					{ kind: 'value', valueType: 'float' },
					{ kind: 'value', valueType: 'float' },
				],
				'float',
				line,
				context
			)
		).not.toThrow();
	});

	it('rejects invalid scalar rules', () => {
		expect(() =>
			validateOperandTypes(
				[
					{ kind: 'value', valueType: 'int' },
					{ kind: 'value', valueType: 'float' },
				],
				'matching',
				line,
				context
			)
		).toThrow(`${ErrorCode.UNMATCHING_OPERANDS}`);
	});

	it('rejects mixed float widths for matching operands', () => {
		expect(() =>
			validateOperandTypes(
				[
					{ kind: 'value', valueType: 'float', isNonZero: false },
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
				'matching',
				line,
				context
			)
		).toThrow(`${ErrorCode.MIXED_FLOAT_WIDTH}`);
	});

	it('validates tuple rules by position', () => {
		expect(() =>
			validateOperandTypes(
				[
					{ kind: 'value', valueType: 'int' },
					{ kind: 'value', valueType: 'float' },
				],
				['int', 'float'],
				line,
				context
			)
		).not.toThrow();
		expect(() =>
			validateOperandTypes(
				[
					{ kind: 'value', valueType: 'float' },
					{ kind: 'value', valueType: 'float' },
				],
				['int', 'float'],
				line,
				context
			)
		).toThrow(`${ErrorCode.TYPE_MISMATCH}`);
	});
});
