import type { AssertEqualLine, SemanticAssertEqualLine } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';
import resolvePushReferences from './push';

/** Resolves the expected operand using the same value rules as an explicit push. */
export default function resolveAssertEqualReferences(
	line: AssertEqualLine,
	context: ReferenceResolutionContext
): SemanticAssertEqualLine {
	const expectedPush = resolvePushReferences(
		{ instruction: 'push', arguments: line.arguments, lineNumber: line.lineNumber },
		context
	);
	return { ...line, expectedPush };
}
