import type { ResolvedMemoryCopyLine } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import memoryCopy from './memoryCopy';

const line: ResolvedMemoryCopyLine = {
	lineNumber: 1,
	instruction: 'memoryCopy',
	arguments: [{ type: ArgumentType.LITERAL, value: 20, isInteger: true }],
};

describe('memoryCopy instruction compiler', () => {
	it('emits raw memory.copy when destination, source, and length are proven safe', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			memoryCopy,
			line,
			context,
			createStackFacts({
				consumedOperands: [
					{
						kind: 'address',
						valueType: 'int',
						isNonZero: false,
						address: {
							safeRange: {
								source: 'memory-start',
								byteAddress: 20,
								safeByteLength: 20,
								memoryId: 0,
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
								memoryId: 0,
							},
						},
					},
				],
			})
		);

		expect(context.instructions).toStrictEqual([{ kind: 'i32.const', value: 20 }, { kind: 'memory.copy' }]);
	});

	it('guards the copy when the length is not proven at compile time', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			memoryCopy,
			line,
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect(context.instructions).toContainEqual({ kind: 'memory.size' });
		expect(context.instructions).toContainEqual({ kind: 'memory.copy' });
	});

	it('compiles memoryCopy 0 as a stack-only no-op', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			memoryCopy,
			{
				...line,
				arguments: [{ type: ArgumentType.LITERAL, value: 0, isInteger: true }],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect(context.instructions).toStrictEqual([]);
	});
});
