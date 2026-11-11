import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine, InstructionSpec } from '@8f4e/language-spec';
import { ErrorCode, getInstructionSpec } from '@8f4e/language-spec';
import { peekStackOperands } from './peekStackOperands';
import { validateOperandTypes } from './validateOperandTypes';

/**
 * Validates stack operand count and type requirements declared by the instruction spec.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Nothing.
 */
export function validateInstruction(line: CompilerASTLine, context: CompilationContext) {
	const spec = getInstructionSpec(line.instruction) as InstructionSpec;

	const validatedOperands = spec.validateOperands?.(line, context);
	const operandsNeeded = validatedOperands?.minOperands ?? spec.minOperands ?? 0;
	const operandTypes = validatedOperands?.operandTypes ?? spec.operandTypes;

	if (operandsNeeded === 0) {
		return;
	}

	const operands = peekStackOperands(context.stack, operandsNeeded);

	if (operands.length < operandsNeeded) {
		throw getError(ErrorCode.INSUFFICIENT_OPERANDS, line, context);
	}

	if (operandTypes) {
		validateOperandTypes(operands, operandTypes, line, context);
	}
}
