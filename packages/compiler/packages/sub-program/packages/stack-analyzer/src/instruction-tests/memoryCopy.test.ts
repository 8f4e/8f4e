import type { CompilerASTLine } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

const line = {
	lineNumber: 1,
	instruction: 'memoryCopy',
	arguments: [{ type: ArgumentType.LITERAL, value: 20, isInteger: true }],
} as CompilerASTLine;
describe('memoryCopy stack analysis', () => {
	it('emits raw memory.copy when destination, source, and length are proven safe', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {
					safeRange: {
						source: 'memory-start',
						byteAddress: 20,
						safeByteLength: 20,
						memoryId: 'target',
					},
				},
			},
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {
					safeRange: {
						source: 'memory-start',
						byteAddress: 0,
						safeByteLength: 20,
						memoryId: 'source',
					},
				},
			}
		);

		analyzeInstruction(line, context);

		expect(context.stack).toHaveLength(0);
	});

	it('guards the copy when the length is not proven at compile time', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: false }
		);

		analyzeInstruction(line, context);

		expect(context.stack).toHaveLength(0);
	});

	it('compiles memoryCopy 0 as a stack-only no-op', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: false }
		);

		analyzeInstruction(
			{
				...line,
				arguments: [{ type: ArgumentType.LITERAL, value: 0, isInteger: true }],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toHaveLength(0);
	});
});
