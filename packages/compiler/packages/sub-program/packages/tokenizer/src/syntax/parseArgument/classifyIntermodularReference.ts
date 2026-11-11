import type { ArgumentIdentifier } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';

/**
 * Classifies intermodular module-base and memory-reference identifier forms.
 *
 * @param value - Identifier token that may refer to another module or one of its memory items.
 * @returns Classified intermodular identifier, or `null` when the token is not an intermodular reference.
 */
export function classifyIntermodularReference(value: string): ArgumentIdentifier | null {
	if (value.startsWith('&')) {
		return classifyStartAddressIntermodularReference(value);
	}

	return null;
}

function classifyStartAddressIntermodularReference(value: string): ArgumentIdentifier | null {
	const colonIndex = value.indexOf(':', 1);
	if (colonIndex === -1 || value.indexOf(':', colonIndex + 1) !== -1) {
		return null;
	}

	const targetModuleId = value.slice(1, colonIndex);
	if (!isValidModuleReferenceName(targetModuleId)) {
		return null;
	}

	const targetMemoryId = value.slice(colonIndex + 1);
	if (targetMemoryId.length === 0) {
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'intermodular-module-reference',
			scope: 'intermodule',
			targetModuleId,
		};
	}

	if (isDecimalDigits(targetMemoryId)) {
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'intermodular-module-nth-reference',
			scope: 'intermodule',
			targetModuleId,
			targetMemoryIndex: Number.parseInt(targetMemoryId, 10),
		};
	}

	if (!isValidModuleReferenceName(targetMemoryId)) {
		return null;
	}

	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: 'intermodular-reference',
		scope: 'intermodule',
		targetModuleId,
		targetMemoryId,
	};
}

function isValidModuleReferenceName(value: string): boolean {
	if (value.length === 0) {
		return false;
	}

	for (let index = 0; index < value.length; index++) {
		const char = value[index];
		if (char === '&' || char === ':' || char === '.' || char === '(' || char === ')' || char.trim() === '') {
			return false;
		}
	}

	return true;
}

function isDecimalDigits(value: string): boolean {
	if (value.length === 0) {
		return false;
	}

	for (let index = 0; index < value.length; index++) {
		const charCode = value.charCodeAt(index);
		if (charCode < 48 || charCode > 57) {
			return false;
		}
	}

	return true;
}
