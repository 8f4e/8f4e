import type { ResolvedMemoryDeclaration, StackItem } from '@8f4e/language-spec';

export type PushValueKind = 'int32' | 'float32' | 'float64';

export function resolveMemoryValueKind(memoryItem: ResolvedMemoryDeclaration): PushValueKind {
	if (memoryItem.isInteger) return 'int32';
	if (memoryItem.isFloat64) return 'float64';
	return 'float32';
}

export function resolveArgumentValueKind(argument: { isInteger: boolean; isFloat64?: boolean }): PushValueKind {
	if (argument.isFloat64) return 'float64';
	return argument.isInteger ? 'int32' : 'float32';
}

type StackItemExtras = Pick<StackItem, 'isNonZero' | 'knownValue'> &
	Partial<Pick<Extract<StackItem, { kind: 'address' }>, 'address' | 'pointsTo'>>;

export function kindToStackItem(kind: PushValueKind, extras?: StackItemExtras): StackItem {
	if (kind === 'int32' && extras?.address) {
		return {
			kind: 'address',
			valueType: 'int',
			address: extras.address,
			...(extras.pointsTo ? { pointsTo: extras.pointsTo } : {}),
			...(extras.isNonZero !== undefined ? { isNonZero: extras.isNonZero } : {}),
			...(extras.knownValue !== undefined ? { knownValue: extras.knownValue } : {}),
		};
	}

	return {
		kind: 'value',
		valueType: kind === 'int32' ? 'int' : kind === 'float64' ? 'float64' : 'float',
		...(extras?.isNonZero !== undefined ? { isNonZero: extras.isNonZero } : {}),
		...(extras?.knownValue !== undefined ? { knownValue: extras.knownValue } : {}),
	};
}
