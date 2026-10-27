import { formatKnownStackValue } from '@8f4e/editor-state';
import type { Stack, StackItem } from '@8f4e/language-spec';

function formatStackItem(item: StackItem): string {
	const knownValue = formatKnownStackValue(item);
	if (knownValue !== undefined) {
		return knownValue;
	}

	return item.kind === 'address' ? 'ptr' : item.valueType;
}

/** Formats compiler stack facts for the inside of the debugger widget's brackets. */
export function formatStack(stack: Stack): string {
	return stack.map(formatStackItem).join(', ');
}
