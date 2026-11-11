import type { MemoryAccessOptions } from '@8f4e/editor-state/memory';
import type { EndAddressIdentifier } from '@8f4e/language-spec';
import { classifyEndQuery } from '@8f4e/tokenizer';

/** Watch-specific inline selectors are separate from the compiler's explicit end-query targets. */
export type WatchTarget =
	| { kind: 'memory'; identifier: string }
	| { kind: 'inline'; options: MemoryAccessOptions }
	| { kind: 'end'; query: EndAddressIdentifier }
	| { kind: 'inline-end'; dereference: boolean };

export interface WatchDirectiveData {
	lineNumber: number;
	displayFormat: 'decimal' | 'binary' | 'hex';
	target: WatchTarget;
}

export function createWatchDirectiveData(args: string[], lineNumber: number): WatchDirectiveData | undefined {
	const expression = args[0] ?? '';
	const displayFormat = expression.startsWith('0b') ? 'binary' : expression.startsWith('0x') ? 'hex' : 'decimal';
	const formattedExpression = displayFormat === 'decimal' ? expression : expression.slice(2);
	if (formattedExpression === 'end()' || formattedExpression === 'end(*)') {
		return {
			lineNumber,
			displayFormat,
			target: { kind: 'inline-end', dereference: formattedExpression === 'end(*)' },
		};
	}
	const endQuery = classifyEndQuery(formattedExpression);
	if (!endQuery.ok) return;
	if (endQuery.value) return { lineNumber, displayFormat, target: { kind: 'end', query: endQuery.value } };
	const inline = /^([&*]?)(?:\[(\d+)\])?$/.exec(formattedExpression);
	if (inline) {
		const [, operator, index] = inline;
		return {
			lineNumber,
			displayFormat,
			target: {
				kind: 'inline',
				options: { showAddress: operator === '&', dereference: operator === '*', bufferPointer: Number(index ?? 0) },
			},
		};
	}
	return { lineNumber, displayFormat, target: { kind: 'memory', identifier: formattedExpression } };
}
