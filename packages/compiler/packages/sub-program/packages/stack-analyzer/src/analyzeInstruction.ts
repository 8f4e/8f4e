import type {
	CompilationContext,
	SemanticReferenceLine,
	StackAnalysisLineFacts,
	StackAnalysisResult,
} from '@8f4e/language-spec';
import { getInstructionSpec, hasBinaryMatchingOperands } from '@8f4e/language-spec';
import { analyzeByInstruction } from './instructionAnalyzers';
import { getNumericOperandKind } from './instructionAnalyzers/numeric/shared';
import { cloneStack } from './instructionAnalyzers/stack';
import { validateInstruction } from './validateInstruction';

/**
 * Validates one AST line, updates stack state, and records the before/after stack analysis metadata.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export function analyzeInstruction(line: SemanticReferenceLine, context: CompilationContext): StackAnalysisLineFacts {
	const stackBefore = cloneStack(context.stack);
	validateInstruction(line, context);
	const { consumed, produced, dropped, targetFunctionId, numericOperandKind, map, clamp } = analyzeByInstruction(
		line,
		context
	);
	const derivedNumericOperandKind =
		numericOperandKind ??
		(hasBinaryMatchingOperands(getInstructionSpec(line.instruction))
			? getNumericOperandKind(consumed[0], consumed[1])
			: undefined);
	const stackAnalysis: StackAnalysisResult = {
		stackBefore,
		stackAfter: cloneStack(context.stack),
		consumedOperands: cloneStack(consumed),
		producedStackItems: cloneStack(produced),
		...(dropped ? { droppedStackItems: cloneStack(dropped) } : {}),
	};

	return {
		stackAnalysis,
		...(targetFunctionId ? { targetFunctionId } : {}),
		...(derivedNumericOperandKind ? { numericOperandKind: derivedNumericOperandKind } : {}),
		...(map ? { map } : {}),
		...(clamp ? { clamp } : {}),
	};
}
