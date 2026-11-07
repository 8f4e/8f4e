import type { ArgumentIdentifier } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { SyntaxErrorCode, SyntaxRulesError } from '../syntaxError';
import { classifyElementQuery } from './classifyElementQuery';
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
 * Required check order (earlier checks must precede later ones):
 *  1. intermodular-module-reference  (&mod: / mod:&)     - before intermodular-reference,
 *     because &mod: starts with & like local memory refs and the module-base form must win.
 *  2. intermodular-module-nth-reference (&mod:0)          - before intermodular-reference,
 *     because digits are valid [^\s&:.] chars so &mod:0 would silently match the named-memory regex.
 *  3. intermodular-reference (&mod:mem / mod:mem&)        - before memory-reference,
 *     because both start/end with & and the intermodular form must win.
 *  4. intermodular element-query forms (count/sizeof/...) - before local element-query forms,
 *     because their pattern (e.g. count(mod:mem)) is a superset of the local form (count(name)).
 *  5. memory-reference (&name / name&)                    - after all intermodular forms.
 *  6. pointee element-query forms                         - before plain element-query forms,
 *     because sizeof(*name) also starts with sizeof( and max(*name) also starts with max(.
 *
 * @param value - Identifier token to classify.
 * @returns Classified identifier argument.
 */
export function classifyIdentifier(value: string): ArgumentIdentifier {
	for (let index = 0; index < value.length; index++) {
		if (value.charCodeAt(index) > 0x7f) {
			throw new SyntaxRulesError(SyntaxErrorCode.INVALID_IDENTIFIER);
		}
	}

	const firstChar = value[0];
	const lastChar = value[value.length - 1];
	const hasIntermoduleSeparator = value.includes(':');
	const hasMemoryReferenceSigil = firstChar === '&' || lastChar === '&';
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
		const elementQuery = classifyElementQuery(value);
		if (elementQuery) {
			return elementQuery;
		}
	}

	// Local memory reference: &name (start) or name& (end).
	// Checked after all intermodular forms since &mod: and &mod:mem also start with &.
	if (hasMemoryReferenceSigil) {
		if (value.startsWith('&*') && value[2] !== '*') {
			const { targetMemoryId } = getMemoryPointerTarget(value.slice(1));
			return {
				type: ArgumentType.IDENTIFIER,
				value,
				referenceKind: 'memory-pointer',
				scope: 'local',
				targetMemoryId,
				dereferenceDepth: 0,
			};
		}

		const isEndAddress = lastChar === '&';
		const targetMemoryId = firstChar === '&' ? value.substring(1) : value.slice(0, -1);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'memory-reference',
			scope: 'local',
			targetMemoryId,
			isEndAddress,
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
