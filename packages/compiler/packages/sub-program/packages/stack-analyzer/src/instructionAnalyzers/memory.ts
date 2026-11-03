import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { ErrorCode, getError } from '@8f4e/language-spec';
import { getClampAccessByteWidth, getClampedAddressStackItem, getModuleAddressRange } from '@8f4e/semantic-utils';
import { consume, createStackValue, produce } from './stack';
import type { InstructionAnalysisResult } from './types';

/**
 * Produces the floating-point value selected by the address's pointee type.
 *
 * @param context - Compilation context containing the address operand.
 * @returns The consumed address and loaded value facts.
 */
export function analyzeLoadFloat(context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 1);
	const address = consumed[0];
	const isFloat64 =
		address.kind === 'address' && address.pointsTo?.baseType === 'float64' && address.pointsTo.pointerDepth === 1;
	const produced = [createStackValue(isFloat64 ? 'float64' : 'float', { isNonZero: false })];
	produce(context, produced);
	return { consumed, produced };
}

/**
 * Consumes an address-like value and produces the stack item representing the clamped address range.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The stack-analysis result for the instruction.
 */
export function analyzeClampAddress(line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 1);
	const accessByteWidth = getClampAccessByteWidth(line);
	const range =
		line.instruction === 'clampAddress'
			? consumed[0].kind === 'address'
				? (consumed[0].address.clampRange ?? consumed[0].address.safeRange)
				: undefined
			: line.instruction === 'clampModuleAddress'
				? getModuleAddressRange(context)
				: undefined;

	if (line.instruction === 'clampAddress' && !range) {
		throw getError(ErrorCode.ADDRESS_RANGE_REQUIRED, line, context);
	}

	if (range && range.safeByteLength < accessByteWidth) {
		throw getError(ErrorCode.ADDRESS_RANGE_TOO_SMALL, line, context);
	}

	const produced = [getClampedAddressStackItem(consumed[0], range, accessByteWidth)];
	produce(context, produced);
	return {
		consumed,
		produced,
		clamp: {
			accessByteWidth,
			...(range ? { range } : {}),
		},
	};
}
