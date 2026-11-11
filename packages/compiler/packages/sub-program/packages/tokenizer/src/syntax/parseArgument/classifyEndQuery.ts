import { ArgumentType, type EndAddressIdentifier } from '@8f4e/language-spec';
import { SyntaxErrorCode, SyntaxIssue } from '../syntaxError';

function invalid(value: string): never {
	throw new SyntaxIssue(
		SyntaxErrorCode.INVALID_IDENTIFIER,
		`Invalid end() query: ${value}. Expected end(memory), end(module:memory), end(module:), or end(*fixedReference).`
	);
}

/** Parses an exclusive-end query into its explicit target selector, without resolving symbols. */
export function classifyEndQuery(value: string): EndAddressIdentifier | null {
	if (!value.startsWith('end(')) return null;
	if (!value.endsWith(')')) invalid(value);
	const target = value.slice(4, -1);
	if (!target || /[()&\s]/.test(target)) invalid(value);
	const base = { type: ArgumentType.IDENTIFIER, value, referenceKind: 'end-address' } as const;
	if (target.startsWith('*')) {
		const targetMemoryId = target.slice(1);
		if (!targetMemoryId || /[*:]/.test(targetMemoryId)) invalid(value);
		return { ...base, scope: 'local', targetKind: 'pointee', targetMemoryId };
	}
	if (target.includes('*')) invalid(value);
	const parts = target.split(':');
	if (parts.length === 1) return { ...base, scope: 'local', targetKind: 'memory', targetMemoryId: target };
	if (parts.length !== 2 || !parts[0]) invalid(value);
	const [targetModuleId, selector] = parts;
	if (!selector) return { ...base, scope: 'intermodule', targetKind: 'module', targetModuleId };
	if (/^\d+$/.test(selector))
		return {
			...base,
			scope: 'intermodule',
			targetKind: 'indexed-memory',
			targetModuleId,
			targetMemoryIndex: Number(selector),
		};
	return { ...base, scope: 'intermodule', targetKind: 'memory', targetModuleId, targetMemoryId: selector };
}
