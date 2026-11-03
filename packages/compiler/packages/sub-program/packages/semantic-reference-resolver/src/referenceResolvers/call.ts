import type { CallLine, SemanticCallLine } from '@8f4e/language-spec';
import { ErrorCode, getError } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';

/** Validates the function symbol after inline arguments have been normalized into pushes. */
export default function resolveCallReferences(line: CallLine, context: ReferenceResolutionContext): SemanticCallLine {
	const target = line.arguments[0];
	if (context.namespace.functions!.arityByName[target.value] === undefined) {
		throw getError(ErrorCode.UNDEFINED_FUNCTION, line, context);
	}
	return { ...line, arguments: [target] };
}
