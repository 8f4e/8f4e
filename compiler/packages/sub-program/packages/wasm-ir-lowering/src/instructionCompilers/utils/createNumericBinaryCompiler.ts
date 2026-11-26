import type { InstructionCompiler, StackItem } from '@8f4e/language-spec';

import { saveByteCode } from './saveByteCode';

type NumericBinaryOpcodes = {
	int32: number;
	float32: number;
	float64: number;
};

type NumericBinaryOperands = {
	left: StackItem;
	right: StackItem;
	isInteger: boolean;
	isFloat64: boolean;
	line: Parameters<InstructionCompiler>[0];
	context: Parameters<InstructionCompiler>[1];
};

type NumericBinaryCompilerOptions = {
	opcodes: NumericBinaryOpcodes;
	validate?: (operands: NumericBinaryOperands) => void;
};

/**
 * Creates instruction compilers for two-operand numeric operations that share opcode selection.
 * Stack effects and validation are owned by stack analysis; codegen only reads the analyzed operands.
 *
 * @returns Created numeric binary compiler.
 */
export default function createNumericBinaryCompiler({
	opcodes,
	validate,
}: NumericBinaryCompilerOptions): InstructionCompiler {
	return (line, context, facts) => {
		const [left, right] = facts.stackAnalysis.consumedOperands;
		const numericOperandKind = facts.numericOperandKind!;
		const isInteger = numericOperandKind === 'int32';
		const isFloat64 = numericOperandKind === 'float64';

		validate?.({ left, right, isInteger, isFloat64, line, context });

		return saveByteCode(context, [opcodes[numericOperandKind]]);
	};
}
