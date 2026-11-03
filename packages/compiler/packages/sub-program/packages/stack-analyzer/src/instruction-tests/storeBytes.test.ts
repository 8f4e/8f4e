import type { CompilerASTLine } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('storeBytes stack analysis', () => {
	it('throws INSUFFICIENT_OPERANDS when stack has fewer than count+1 items', () => {
		const context = createStackAnalyzerTestContext();
		// Only 2 items on stack but count=3 requires 4
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: false }
		);
		const line = {
			lineNumber: 1,
			instruction: 'storeBytes',
			arguments: [{ type: ArgumentType.LITERAL, value: 3, isInteger: true }],
		} as CompilerASTLine;

		expect(() => {
			analyzeInstruction(line, context);
		}).toThrow();
	});

	it('compiles storeBytes 3 and leaves an empty stack', () => {
		const context = createStackAnalyzerTestContext();
		// bytes pushed first, addr pushed last (on top)
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {
					safeRange: {
						source: 'memory-start',
						byteAddress: 0,
						safeByteLength: 3,
						memoryId: 'test',
					},
				},
			}
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'storeBytes',
				arguments: [{ type: ArgumentType.LITERAL, value: 3, isInteger: true }],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toHaveLength(0);
	});

	it('guards byte stores when address metadata is shorter than the byte count', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {
					safeRange: {
						source: 'memory-start',
						byteAddress: 0,
						safeByteLength: 1,
						memoryId: 'test',
					},
				},
			}
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'storeBytes',
				arguments: [{ type: ArgumentType.LITERAL, value: 2, isInteger: true }],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toHaveLength(0);
	});

	it('compiles storeBytes 0 (address-only pop) and leaves an empty stack', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			isNonZero: false,
			address: {
				safeRange: {
					source: 'memory-start',
					byteAddress: 0,
					safeByteLength: 0,
					memoryId: 'test',
				},
			},
		});

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'storeBytes',
				arguments: [{ type: ArgumentType.LITERAL, value: 0, isInteger: true }],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toHaveLength(0);
	});
});
