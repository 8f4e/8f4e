import type { CompilerASTLine, SemanticReferenceLine } from '@8f4e/language-spec';
import { isMemoryDeclarationLine } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';
import resolveAssertEqualReferences from './assertEqual';
import resolveCallReferences from './call';
import resolveClampAddressReferences from './clampAddress';
import resolveDefaultReferences from './default';
import resolveLocalVariableAccess from './localVariable';
import resolveLoopReferences from './loop';
import resolveMapReferences from './map';
import resolveMemoryCopyReferences from './memoryCopy';
import resolveMemoryDeclarationReferences from './memoryDeclaration';
import resolvePushReferences from './push';

const instructionReferenceResolvers = {
	assertEqual: resolveAssertEqualReferences,
	call: resolveCallReferences,
	clampAddress: resolveClampAddressReferences,
	clampGlobalAddress: resolveClampAddressReferences,
	clampModuleAddress: resolveClampAddressReferences,
	default: resolveDefaultReferences,
	localSet: resolveLocalVariableAccess,
	loop: resolveLoopReferences,
	map: resolveMapReferences,
	memoryCopy: resolveMemoryCopyReferences,
	push: resolvePushReferences,
} as const;

/**
 * Dispatches line-specific semantic reference resolution.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function resolveLineReferences<TLine extends CompilerASTLine>(
	line: TLine,
	context: ReferenceResolutionContext
): SemanticReferenceLine<TLine> {
	const referenceResolver =
		instructionReferenceResolvers[line.instruction as keyof typeof instructionReferenceResolvers];
	if (referenceResolver) {
		return referenceResolver(line as never, context) as SemanticReferenceLine<TLine>;
	}

	if (isMemoryDeclarationLine(line)) {
		return resolveMemoryDeclarationReferences(line as never, context) as SemanticReferenceLine<TLine>;
	}

	return line as SemanticReferenceLine<TLine>;
}
