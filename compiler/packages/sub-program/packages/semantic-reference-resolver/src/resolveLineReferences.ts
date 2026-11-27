import type { CompilerASTLine, SemanticReferenceLine } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from './context';
import resolveInstructionReferences from './referenceResolvers';

/** Resolves source bindings and value references for one normalized operation. */
export default function resolveLineReferences<TLine extends CompilerASTLine>(
	line: TLine,
	context: ReferenceResolutionContext
): SemanticReferenceLine<TLine> {
	return resolveInstructionReferences(line, context);
}
