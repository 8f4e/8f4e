import {
	ArgumentType,
	type CompilerASTLine,
	isArrayMemoryDeclarationLine,
	type MemoryDeclarationLine,
} from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';
import { validateAddressReference, validateUnresolvedIdentifier, validateUnresolvedValueExpression } from './helpers';

function requireResolvedArrayValue(
	argument: CompilerASTLine['arguments'][number] | undefined,
	line: CompilerASTLine,
	context: ReferenceResolutionContext
) {
	if (argument?.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
		validateUnresolvedValueExpression(argument, line, context);
	}

	if (argument?.type === ArgumentType.IDENTIFIER) {
		validateUnresolvedIdentifier(argument, line, context);
	}
}

/**
 * Resolves value arguments for memory declaration instructions
 * (int, float, float64, array types, pointer types, etc.).
 * Scalar declarations resolve the name/default slots; array declarations resolve
 * the element-count slot and all inline initializer values.
 * Validates intermodule references in default/initializer values if present.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Memory declaration line with resolved value arguments.
 */
export default function resolveMemoryDeclarationReferences(
	line: MemoryDeclarationLine,
	context: ReferenceResolutionContext
): MemoryDeclarationLine {
	const isArrayDeclaration = isArrayMemoryDeclarationLine(line);

	const scalarValidationIndexes = isArrayDeclaration ? [0] : [0, 1];
	for (const index of scalarValidationIndexes) {
		const argument = line.arguments[index];
		if (argument?.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
			validateUnresolvedValueExpression(argument, line, context);
		}
		if (index === 1 && argument?.type === ArgumentType.IDENTIFIER) {
			validateAddressReference(argument, line, context);
		}
	}

	if (isArrayMemoryDeclarationLine(line)) {
		requireResolvedArrayValue(line.arguments[1], line, context);

		for (let index = 2; index < line.arguments.length; index++) {
			requireResolvedArrayValue(line.arguments[index], line, context);
		}
	}

	return line;
}
