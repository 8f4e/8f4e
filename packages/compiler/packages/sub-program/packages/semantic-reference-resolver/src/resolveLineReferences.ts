import type { CompilerASTLine, PushArgument, SemanticReferenceLine } from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from './context';
import resolveInstructionReferences from './referenceResolvers';
import resolvePushReferences from './referenceResolvers/push';

/**
 * Resolves semantic value arguments for one AST line.
 * This folds memory/layout expressions in instruction-specific value positions.
 * Constant and memory-reference facts are expected to have been applied before semantic reference resolution.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function resolveLineReferences<TLine extends CompilerASTLine>(
	line: TLine,
	context: ReferenceResolutionContext
): SemanticReferenceLine<TLine> {
	const spec = getInstructionSpec(line.instruction);
	if (spec && 'inlineOperand' in spec && spec.inlineOperand && line.arguments.length) {
		return {
			...line,
			inlineOperandPush: resolvePushReferences(
				{
					lineNumber: line.lineNumber,
					instruction: 'push',
					arguments: [line.arguments[0] as PushArgument],
				},
				context
			),
		} as SemanticReferenceLine<TLine>;
	}
	return resolveInstructionReferences(line, context);
}
