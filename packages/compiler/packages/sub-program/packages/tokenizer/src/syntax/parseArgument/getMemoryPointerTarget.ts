import { SyntaxErrorCode, SyntaxIssue } from '../syntaxError';

/**
 * Reads the target memory id and dereference depth from a memory-pointer identifier token.
 *
 * @param value - Memory-pointer identifier token such as `*buffer` or `**cursor`.
 * @returns Target memory id and dereference depth parsed from the token.
 */
export function getMemoryPointerTarget(value: string): { targetMemoryId: string; dereferenceDepth: number } {
	const dereferenceDepth = getLeadingPointerDepth(value);
	if (dereferenceDepth > 2) {
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_POINTER_DEPTH);
	}

	const targetMemoryId = value.slice(dereferenceDepth);
	if (targetMemoryId.trim().length === 0) {
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_IDENTIFIER, `Memory pointer target is missing: ${value}`);
	}

	return { targetMemoryId, dereferenceDepth };
}

function getLeadingPointerDepth(value: string): number {
	let pointerDepth = 0;
	while (value[pointerDepth] === '*') {
		pointerDepth++;
	}
	return pointerDepth;
}
