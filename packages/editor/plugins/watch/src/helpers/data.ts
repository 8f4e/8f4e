import type { MemoryAccessOptions } from '@8f4e/editor-state/memory';
import { classifyEndQuery } from '@8f4e/tokenizer';

export type WatchDirectiveData = {
	lineNumber: number;
	displayFormat: 'decimal' | 'binary' | 'hex';
	showEndAddress: boolean;
} & ({ memoryId: string; inlineAccess?: never } | { memoryId?: never; inlineAccess: MemoryAccessOptions });

export function createWatchDirectiveData(args: string[], lineNumber: number): WatchDirectiveData {
	const expression = args[0] ?? '';
	const displayFormat = expression.startsWith('0b') ? 'binary' : expression.startsWith('0x') ? 'hex' : 'decimal';
	const formattedExpression = displayFormat === 'decimal' ? expression : expression.slice(2);
	const endQuery = classifyEndQuery(formattedExpression);
	const showEndAddress =
		(endQuery.ok && endQuery.value !== null) || formattedExpression === 'end()' || formattedExpression === 'end(*)';
	const memoryExpression = showEndAddress ? formattedExpression.slice(4, -1) : formattedExpression;
	const inline = /^([&*]?)(?:\[(\d+)\])?$/.exec(memoryExpression);
	if (inline) {
		const [, operator, index] = inline;
		return {
			lineNumber,
			displayFormat,
			showEndAddress,
			inlineAccess: { showAddress: operator === '&', dereference: operator === '*', bufferPointer: Number(index ?? 0) },
		};
	}

	return {
		memoryId: memoryExpression,
		lineNumber,
		displayFormat,
		showEndAddress,
	};
}
