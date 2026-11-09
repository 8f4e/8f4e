import type { MemoryAccessOptions } from '@8f4e/editor-state/memory';

export type WatchDirectiveData = {
	lineNumber: number;
	displayFormat: 'decimal' | 'binary' | 'hex';
	showEndAddress: boolean;
} & ({ memoryId: string; inlineAccess?: never } | { memoryId?: never; inlineAccess: MemoryAccessOptions });

export function createWatchDirectiveData(args: string[], lineNumber: number): WatchDirectiveData {
	const expression = args[0] ?? '';
	const displayFormat = expression.startsWith('0b') ? 'binary' : expression.startsWith('0x') ? 'hex' : 'decimal';
	const formattedExpression = displayFormat === 'decimal' ? expression : expression.slice(2);
	const inline = /^([&*]?)(?:\[(\d+)\]|(&))?$/.exec(formattedExpression);
	if (inline) {
		const [, operator, index, end] = inline;
		return {
			lineNumber,
			displayFormat,
			showEndAddress: end === '&',
			inlineAccess: { showAddress: operator === '&', dereference: operator === '*', bufferPointer: Number(index ?? 0) },
		};
	}

	const showEndAddress = formattedExpression.endsWith('&');
	return {
		memoryId: showEndAddress ? formattedExpression.slice(0, -1) : formattedExpression,
		lineNumber,
		displayFormat,
		showEndAddress,
	};
}
