import { getError } from '@8f4e/compiler-diagnostics';
import type {
	CompilationContext,
	CompilerASTLine,
	StackAnalysisNumericValueKind,
	StackValueType,
} from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';

/**
 * Validates that a map input, row value, or default value matches the expected map kind.
 *
 * @param valueKind - Map or stack value metadata to resolve.
 * @param expectedKind - Map kind that the value must match.
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Nothing.
 */
export function validateMapValueKind(
	valueKind: { valueType: StackValueType },
	expectedKind: StackAnalysisNumericValueKind,
	line: CompilerASTLine,
	context: CompilationContext
) {
	if (expectedKind === 'float64') {
		if (valueKind.valueType === 'int') {
			throw getError(ErrorCode.ONLY_FLOATS, line, { symbol: context.codeBlockId });
		}
		if (valueKind.valueType !== 'float64') {
			throw getError(ErrorCode.MIXED_FLOAT_WIDTH, line, { symbol: context.codeBlockId });
		}
		return;
	}

	if (expectedKind === 'int32') {
		if (valueKind.valueType !== 'int') {
			throw getError(ErrorCode.ONLY_INTEGERS, line, { symbol: context.codeBlockId });
		}
		return;
	}

	if (valueKind.valueType === 'int') {
		throw getError(ErrorCode.ONLY_FLOATS, line, { symbol: context.codeBlockId });
	}
	if (valueKind.valueType === 'float64') {
		throw getError(ErrorCode.MIXED_FLOAT_WIDTH, line, { symbol: context.codeBlockId });
	}
}
