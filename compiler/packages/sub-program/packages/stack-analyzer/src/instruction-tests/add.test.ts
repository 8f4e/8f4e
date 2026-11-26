import type { CompilerASTLine } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('add stack analysis', () => {
	it('keeps address metadata when adding a known in-range byte offset', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				knownValue: 0,
				address: {
					safeRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 0 },
				},
			},
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 }
		);

		analyzeInstruction(
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'add', arguments: [] } as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 4,
				address: {
					safeRange: { source: 'memory-start', byteAddress: 4, safeByteLength: 124, memoryId: 0 },
					clampRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 0 },
				},
			},
		]);
	});

	it('drops the safe range when adding a known out-of-range byte offset', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				knownValue: 0,
				address: {
					safeRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 0 },
				},
			},
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 1024 }
		);

		analyzeInstruction(
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'add', arguments: [] } as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 1024,
				address: {
					clampRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 128, memoryId: 0 },
				},
			},
		]);
	});

	it.each(['address-first', 'address-second'] as const)(
		'preserves pointee type without claiming safety with the %s',
		order => {
			const context = createStackAnalyzerTestContext();
			const address = {
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {},
				pointsTo: { baseType: 'float', pointerDepth: 1 },
			} as const;
			const offset = { kind: 'value', valueType: 'int', isNonZero: false } as const;
			context.stack.push(...(order === 'address-first' ? [address, offset] : [offset, address]));

			analyzeInstruction(
				{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'add', arguments: [] } as CompilerASTLine,
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
		}
	);

	it('rejects adding two addresses', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'address', valueType: 'int', isNonZero: false, address: {} },
			{ kind: 'address', valueType: 'int', isNonZero: false, address: {} }
		);
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 1,
			instruction: 'add',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: ErrorCode.INVALID_ADDRESS_ARITHMETIC,
					instruction: line.instruction,
					location: expect.objectContaining({ ...line.diagnosticSource, lineNumber: line.lineNumber }),
				}),
			})
		);
	});
});
