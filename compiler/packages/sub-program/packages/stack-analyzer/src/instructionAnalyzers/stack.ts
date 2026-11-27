import type { CompilationContext, Stack, StackItem, StackValueType } from '@8f4e/language-spec';

/**
 * Creates a value stack item with optional known-value metadata preserved for later guards.
 *
 * @param valueType - Stack value type for the item being created.
 * @param metadata - Optional known-value metadata to copy onto the stack item.
 * @returns The relevant stack items for the analysis step.
 */
export function createStackValue(
	valueType: StackValueType,
	metadata: Pick<StackItem, 'isNonZero' | 'knownValue'> = {}
): StackItem {
	const knownValue =
		valueType === 'int' && metadata.knownValue !== undefined ? metadata.knownValue | 0 : metadata.knownValue;
	const isNonZero = valueType === 'int' && knownValue !== undefined ? knownValue !== 0 : metadata.isNonZero;
	return {
		kind: 'value',
		valueType,
		...(isNonZero !== undefined ? { isNonZero } : {}),
		...(knownValue !== undefined ? { knownValue } : {}),
	};
}

/**
 * Clones stack items deeply enough to snapshot mutable address metadata safely.
 *
 * @param stack - Stack to inspect or clone.
 * @returns The relevant stack items for the analysis step.
 */
export function cloneStack(stack: Stack): Stack {
	return stack.map(item => ({
		...item,
		...(item.kind === 'address' ? { address: { ...item.address } } : {}),
		...(item.kind === 'address' && item.pointsTo ? { pointsTo: { ...item.pointsTo } } : {}),
	}));
}

/**
 * Removes and returns the requested number of items from the top of the semantic stack.
 *
 * @param context - Compilation context used by the operation.
 * @param count - Number of stack items to inspect or consume.
 * @returns The relevant stack items for the analysis step.
 */
export function consume(context: CompilationContext, count: number): Stack {
	if (count === 0) {
		return [];
	}

	return context.stack.splice(context.stack.length - count, count);
}

/**
 * Appends newly produced items to the semantic stack.
 *
 * @param context - Compilation context used by the operation.
 * @param items - items value to use.
 * @returns Nothing.
 */
export function produce(context: CompilationContext, items: Stack): void {
	context.stack.push(...items);
}
