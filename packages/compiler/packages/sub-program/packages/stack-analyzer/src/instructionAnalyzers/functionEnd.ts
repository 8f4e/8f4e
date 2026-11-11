import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine, Stack } from '@8f4e/language-spec';
import { ErrorCode, stackItemMatchesFunctionValueType } from '@8f4e/language-spec';
import { consume } from './stack';

/**
 * Consumes and validates function return values against the parsed function signature.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the function end instruction.
 */
export function analyzeFunctionEnd(line: CompilerASTLine, context: CompilationContext): Stack {
	const returnTypes = context.currentFunctionMetadata!.signature.returns;

	if (context.stack.length !== returnTypes.length) {
		throw getError(ErrorCode.STACK_MISMATCH_FUNCTION_RETURN, line, context);
	}

	for (let i = 0; i < returnTypes.length; i++) {
		const stackItem = context.stack[context.stack.length - returnTypes.length + i];
		const returnType = returnTypes[i];
		if (!stackItemMatchesFunctionValueType(stackItem, returnType)) {
			throw getError(ErrorCode.STACK_MISMATCH_FUNCTION_RETURN, line, context);
		}
	}

	return consume(context, returnTypes.length);
}
