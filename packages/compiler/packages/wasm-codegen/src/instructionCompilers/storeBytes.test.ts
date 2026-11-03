import { WASM_MEMORY_SIZE } from '@8f4e/compiler-wasm-utils';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import storeBytes from './storeBytes';

describe('storeBytes instruction compiler', () => {
	it('emits i32.store8 opcode (0x3a = 58) for each byte', () => {
		const context = createInstructionCompilerTestContext();
		// bytes pushed first, addr pushed last (on top)

		compileInstructionForTest(
			storeBytes,
			{
				lineNumber: 1,
				instruction: 'storeBytes',
				arguments: [{ type: ArgumentType.LITERAL, value: 2, isInteger: true }],
			},
			context,
			createStackFacts({
				consumedOperands: [
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
								safeByteLength: 2,
								memoryId: 'test',
							},
						},
					},
				],
			})
		);

		expect(context.byteCode.filter(b => b === 0x3a)).toHaveLength(2);
	});

	it('guards byte stores when address metadata is shorter than the byte count', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			storeBytes,
			{
				lineNumber: 1,
				instruction: 'storeBytes',
				arguments: [{ type: ArgumentType.LITERAL, value: 2, isInteger: true }],
			},
			context,
			createStackFacts({
				consumedOperands: [
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
					},
				],
			})
		);

		expect(context.byteCode).toContain(WASM_MEMORY_SIZE);
	});
});
