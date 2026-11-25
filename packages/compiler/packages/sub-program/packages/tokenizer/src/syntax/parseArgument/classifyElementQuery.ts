import type { ArgumentIdentifier } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { SyntaxErrorCode, SyntaxIssue } from '../syntaxError';

/**
 * Classifies local, intermodular, and pointee metadata query identifier forms.
 *
 * @param value - Identifier token that may contain a metadata query.
 * @returns Classified metadata-query identifier, or `null` when the token is not a metadata query.
 */
export function classifyElementQuery(value: string): ArgumentIdentifier | null {
	switch (value[0]) {
		case 'c':
			return classifyCountQuery(value);
		case 's':
			return classifyWordSizeQuery(value);
		case 'm':
			if (value.startsWith('max(')) {
				return classifyMaxQuery(value);
			}
			return classifyMinQuery(value);
		default:
			return null;
	}
}

function classifyCountQuery(value: string): ArgumentIdentifier | null {
	const targetMemoryId = extractQueryInner(value, 'count(');
	if (targetMemoryId === null) {
		return null;
	}

	const intermodule = parseIntermodularElementQuery(targetMemoryId);
	if (intermodule) {
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'intermodular-element-count',
			scope: 'intermodule',
			targetModuleId: intermodule.targetModuleId,
			targetMemoryId: intermodule.targetMemoryId,
		};
	}

	if (targetMemoryId.startsWith('*')) {
		const pointeeTargetMemoryId = getPointeeQueryTarget(value, targetMemoryId);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'pointee-element-count',
			scope: 'local',
			targetMemoryId: pointeeTargetMemoryId,
			isPointee: true,
		};
	}

	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: 'element-count',
		scope: 'local',
		targetMemoryId,
	};
}

function classifyWordSizeQuery(value: string): ArgumentIdentifier | null {
	const targetMemoryId = extractQueryInner(value, 'sizeof(');
	if (targetMemoryId === null) {
		return null;
	}

	const intermodule = parseIntermodularElementQuery(targetMemoryId);
	if (intermodule) {
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'intermodular-element-word-size',
			scope: 'intermodule',
			targetModuleId: intermodule.targetModuleId,
			targetMemoryId: intermodule.targetMemoryId,
		};
	}

	if (targetMemoryId.startsWith('*')) {
		const pointeeTargetMemoryId = getPointeeQueryTarget(value, targetMemoryId);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'pointee-element-word-size',
			scope: 'local',
			targetMemoryId: pointeeTargetMemoryId,
			isPointee: true,
		};
	}

	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: 'element-word-size',
		scope: 'local',
		targetMemoryId,
	};
}

function classifyMaxQuery(value: string): ArgumentIdentifier | null {
	const targetMemoryId = extractQueryInner(value, 'max(');
	if (targetMemoryId === null) {
		return null;
	}

	const intermodule = parseIntermodularElementQuery(targetMemoryId);
	if (intermodule) {
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'intermodular-element-max',
			scope: 'intermodule',
			targetModuleId: intermodule.targetModuleId,
			targetMemoryId: intermodule.targetMemoryId,
		};
	}

	if (targetMemoryId.startsWith('*')) {
		const pointeeTargetMemoryId = getPointeeQueryTarget(value, targetMemoryId);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'pointee-element-max',
			scope: 'local',
			targetMemoryId: pointeeTargetMemoryId,
			isPointee: true,
		};
	}

	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: 'element-max',
		scope: 'local',
		targetMemoryId,
	};
}

function classifyMinQuery(value: string): ArgumentIdentifier | null {
	const targetMemoryId = extractQueryInner(value, 'min(');
	if (targetMemoryId === null) {
		return null;
	}

	const intermodule = parseIntermodularElementQuery(targetMemoryId);
	if (intermodule) {
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'intermodular-element-min',
			scope: 'intermodule',
			targetModuleId: intermodule.targetModuleId,
			targetMemoryId: intermodule.targetMemoryId,
		};
	}

	if (targetMemoryId.startsWith('*')) {
		const pointeeTargetMemoryId = getPointeeQueryTarget(value, targetMemoryId);
		return {
			type: ArgumentType.IDENTIFIER,
			value,
			referenceKind: 'pointee-element-min',
			scope: 'local',
			targetMemoryId: pointeeTargetMemoryId,
			isPointee: true,
		};
	}

	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: 'element-min',
		scope: 'local',
		targetMemoryId,
	};
}

function extractQueryInner(value: string, prefix: string): string | null {
	if (!value.startsWith(prefix) || !value.endsWith(')')) {
		return null;
	}

	const inner = value.slice(prefix.length, -1);
	if (inner.trim().length === 0) {
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_IDENTIFIER, `Metadata query target is missing: ${value}`);
	}

	return inner;
}

function getPointeeQueryTarget(value: string, targetMemoryId: string): string {
	const pointeeTargetMemoryId = targetMemoryId.slice(1);
	if (pointeeTargetMemoryId.trim().length === 0) {
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_IDENTIFIER, `Pointee metadata query target is missing: ${value}`);
	}

	return pointeeTargetMemoryId;
}

function parseIntermodularElementQuery(value: string): { targetModuleId: string; targetMemoryId: string } | null {
	const colonIndex = value.indexOf(':');
	if (colonIndex === -1 || value.indexOf(':', colonIndex + 1) !== -1) {
		return null;
	}

	const targetModuleId = value.slice(0, colonIndex);
	const targetMemoryId = value.slice(colonIndex + 1);
	if (!isValidElementReferenceName(targetModuleId) || !isValidElementReferenceName(targetMemoryId)) {
		return null;
	}

	return { targetModuleId, targetMemoryId };
}

function isValidElementReferenceName(value: string): boolean {
	if (value.length === 0) {
		return false;
	}

	for (let index = 0; index < value.length; index++) {
		const char = value[index];
		if (char === ':' || char === '(' || char === ')' || char.trim() === '') {
			return false;
		}
	}

	return true;
}
