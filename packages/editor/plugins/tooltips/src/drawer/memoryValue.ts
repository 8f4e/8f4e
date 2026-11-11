import { type PreparedNumericRead, readNumericValue } from '@8f4e/editor-state/memory';
import type { MemoryViews } from '@8f4e/web-ui';

/** Format one live tooltip value using the declaration's storage width and numeric type. */
export function formatMemoryValue(memory: MemoryViews, read: PreparedNumericRead): string {
	const value = readNumericValue(read, memory);
	return value === undefined ? '?' : read.spec.isInteger ? String(value) : value.toFixed(4);
}
