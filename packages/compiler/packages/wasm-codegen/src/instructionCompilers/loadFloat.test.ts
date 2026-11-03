import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	containsByteCodeSequence,
	createStackFacts as createBaseStackFacts,
} from '../../tests/testUtils';
import loadFloat from './loadFloat';

/** Builds the analyzed float32 result used by the existing load cases. */
function createStackFacts(options: Parameters<typeof createBaseStackFacts>[0]) {
	const facts = createBaseStackFacts(options);
	facts.stackAnalysis.producedStackItems = [{ kind: 'value', valueType: 'float', isNonZero: false }];
	return facts;
}

describe('loadFloat instruction compiler', () => {
	it.each([
		{ safeByteLength: 8, guarded: false },
		{ safeByteLength: 4, guarded: true },
		{ safeByteLength: 0, guarded: true },
	])('loads float64 with $safeByteLength proven bytes and guarded=$guarded', ({ safeByteLength, guarded }) => {
		const context = createInstructionCompilerTestContext();
		const facts = createStackFacts({
			consumedOperands: [
				{
					kind: 'address',
					valueType: 'int',
					address: {
						safeRange: { source: 'memory-start', byteAddress: 0, safeByteLength, memoryId: 'double' },
					},
				},
			],
		});
		facts.stackAnalysis.producedStackItems = [{ kind: 'value', valueType: 'float64', isNonZero: false }];
		compileInstructionForTest(loadFloat, { lineNumber: 1, instruction: 'loadFloat', arguments: [] }, context, facts);
		expect(containsByteCodeSequence(context.byteCode, [0x2b, 3, 0])).toBe(true);
		expect(containsByteCodeSequence(context.byteCode, [0x04, 0x7c])).toBe(guarded);
		expect(context.byteCode).toMatchSnapshot();
	});

	it('loads from a safe memory address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			loadFloat,
			{
				lineNumber: 1,
				instruction: 'loadFloat',
				arguments: [],
			},
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
								byteAddress: 0,
								safeByteLength: 4,
								memoryId: 'test',
							},
						},
					},
				],
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('loads from an unsafe memory address with a bounds guard', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			loadFloat,
			{
				lineNumber: 2,
				instruction: 'loadFloat',
				arguments: [],
			},
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int', isNonZero: false }] })
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
