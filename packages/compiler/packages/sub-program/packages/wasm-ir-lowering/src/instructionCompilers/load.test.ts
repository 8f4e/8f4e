import { WASM_IF } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import load from './load';

describe('load instruction compiler', () => {
	it('loads from a safe memory address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			load,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'load', arguments: [] },
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
								memoryId: 0,
							},
						},
					},
				],
			})
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('loads from an unsafe memory address with a bounds guard', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			load,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 2, instruction: 'load8u', arguments: [] },
			context,
			createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int', isNonZero: false }] })
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('guards when address metadata is shorter than the access width', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			load,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 3, instruction: 'load', arguments: [] },
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
								safeByteLength: 2,
								memoryId: 0,
							},
						},
					},
				],
			})
		);

		expect(context.instructions).toContainEqual(expect.objectContaining({ kind: 'block', opcode: WASM_IF }));
	});

	it('does not guard when an explicit clamp proves the access width is safe', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			load,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 4, instruction: 'load', arguments: [] },
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'address', valueType: 'int', isNonZero: false, address: { safeAccessByteWidth: 4 } },
				],
			})
		);

		expect(context.instructions).not.toContainEqual(expect.objectContaining({ kind: 'block', opcode: WASM_IF }));
	});
});
