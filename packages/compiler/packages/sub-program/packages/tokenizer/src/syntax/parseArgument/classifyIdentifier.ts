import type { ArgumentIdentifier } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { SyntaxErrorCode, SyntaxIssue } from '../syntaxError';
import { classifyElementQuery } from './classifyElementQuery';
import { classifyEndQuery } from './classifyEndQuery';
import { classifyIntermodularReference } from './classifyIntermodularReference';
import { getMemoryPointerTarget } from './getMemoryPointerTarget';

function classifySimpleIdentifier(value: string): ArgumentIdentifier {
	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: isConstantIdentifierName(value) ? 'constant' : 'plain',
		scope: 'local',
	};
}

function isConstantIdentifierName(value: string): boolean {
	if (value.length === 0 || !isUppercaseAsciiLetter(value.charCodeAt(0))) {
		return false;
	}

	for (let index = 1; index < value.length; index++) {
		if (isLowercaseAsciiLetter(value.charCodeAt(index))) {
			return false;
		}
	}

	return true;
}

function isUppercaseAsciiLetter(charCode: number): boolean {
	return charCode >= 65 && charCode <= 90;
}

function isLowercaseAsciiLetter(charCode: number): boolean {
	return charCode >= 97 && charCode <= 122;
}

/**
 * Classifies an identifier string into a structured `ArgumentIdentifier` with reference metadata.
 * Classification is based purely on token shape; no semantic resolution is performed.
 *
 * Qualified start-address selectors are handled before the local & operator. Function-style
 * queries have their own parsers and AST nodes; end() never passes through prefix handling.
 *
 * @param value - Identifier token to classify.
 * @returns Classified identifier argument.
 */
export function classifyIdentifier(value: string): ArgumentIdentifier {
	for (let index = 0; index < value.length; index++) {
		if (value.charCodeAt(index) > 0x7f) {
			throw new SyntaxIssue(SyntaxErrorCode.INVALID_IDENTIFIER);
		}
	}

	if (value.endsWith('&')) {
		throw new SyntaxIssue(
			SyntaxErrorCode.INVALID_IDENTIFIER,
			`Trailing & end addresses were removed. Use end(${value.slice(0, -1)}) instead.`
		);
	}

	const firstChar = value[0];
	const hasIntermoduleSeparator = value.includes(':');
	const hasMemoryReferenceSigil = firstChar === '&';
	const hasPointerPrefix = firstChar === '*';
	const hasQueryOpen = value.includes('(');

	// This classifier sits in the compilation hot path, so the dispatch below is intentionally
	// micro-optimized to avoid calling every shape helper for plain identifier-like tokens.
	if (!hasIntermoduleSeparator && !hasMemoryReferenceSigil && !hasPointerPrefix && !hasQueryOpen) {
		return classifySimpleIdentifier(value);
	}

	// Intermodular module-base and memory references must be checked before local memory references.
	if (hasIntermoduleSeparator) {
		const intermodularReference = classifyIntermodularReference(value);
		if (intermodularReference) {
			return intermodularReference;
		}
	}

	// Metadata query parsing keeps intermodular forms ahead of local and pointee forms.
	if (hasQueryOpen) {
		const elementQuery = classifyEndQuery(value) ?? classifyElementQuery(value);
		if (elementQuery) {
			return elementQuery;
		}
	}

	// Leading & denotes a start address; end() is classified separately as a query.
	// Checked after all intermodular forms since &mod: and &mod:mem also start with &.
	if (hasMemoryReferenceSigil) {
		const targetMemoryId = value.substring(1);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'memory-reference',
			scope: 'local',
			targetMemoryId,
		};
	}

	// Memory pointer: *name
	if (hasPointerPrefix) {
		const { targetMemoryId, dereferenceDepth } = getMemoryPointerTarget(value);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'memory-pointer',
			scope: 'local',
			targetMemoryId,
			dereferenceDepth,
		};
	}

	return classifySimpleIdentifier(value);
}
