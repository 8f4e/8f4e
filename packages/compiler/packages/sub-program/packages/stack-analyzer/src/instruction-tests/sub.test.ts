import type { CompilerASTLine } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('sub stack analysis', () => {
	it('keeps address metadata when subtracting a known negative in-range byte offset', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				knownValue: 0,
				address: {
					safeRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 'arr' },
				},
			},
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: -4 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'sub',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 4,
				address: {
					safeRange: { source: 'memory-start', byteAddress: 4, safeByteLength: 124, memoryId: 'arr' },
					clampRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 'arr' },
				},
			},
		]);
	});

	it('drops the safe range when subtracting a known positive offset from a start-range address', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				knownValue: 0,
				address: {
					safeRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 'arr' },
				},
			},
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'sub',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: -4,
				address: {
					clampRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 'arr' },
				},
			},
		]);
	});

	it('preserves pointee type without claiming safety when subtracting a runtime offset', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {},
				pointsTo: { baseType: 'float', pointerDepth: 1 },
			},
			{ kind: 'value', valueType: 'int', isNonZero: false }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'sub',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				address: {},
				pointsTo: { baseType: 'float', pointerDepth: 1 },
			},
		]);
	});

	it('produces a plain integer when subtracting two addresses', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'address', valueType: 'int', isNonZero: true, knownValue: 12, address: {} },
			{ kind: 'address', valueType: 'int', isNonZero: true, knownValue: 4, address: {} }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'sub',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 8 }]);
	});

	it('rejects subtracting an address from an integer', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'address', valueType: 'int', isNonZero: false, address: {} }
		);
		const line = { lineNumber: 1, instruction: 'sub', arguments: [] } as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({ code: ErrorCode.INVALID_ADDRESS_ARITHMETIC, line })
		);
	});
});
