import type { TypedValueKind } from '@8f4e/editor-state-types';
import {
	BASE_TYPE_METADATA,
	getMemoryBaseType,
	type PlannedMemoryDeclaration,
	type PointeeBaseType,
} from '@8f4e/language-spec';

/** Numeric storage and default display bounds, independent of a renderer or runtime memory instance. */
export interface TypedValueSpec {
	valueType: TypedValueKind;
	elementByteSize: number;
	isInteger: boolean;
	minValue: number;
	maxValue: number;
}

const viewKinds: Record<PointeeBaseType, TypedValueKind> = {
	int8: 'int8',
	int8u: 'uint8',
	int16: 'int16',
	int16u: 'uint16',
	int: 'int32',
	float: 'float32',
	float64: 'float64',
};

function getTypeSpec(type: PointeeBaseType): TypedValueSpec {
	const metadata = BASE_TYPE_METADATA[type];
	return {
		valueType: viewKinds[type],
		elementByteSize: metadata.wordSize,
		isInteger: metadata.isInteger,
		minValue: metadata.isInteger ? metadata.min : -1,
		maxValue: metadata.isInteger ? metadata.max : 1,
	};
}

/** Uses the allocation plan's authoritative storage width, signedness, and numeric kind. */
export function getMemoryValueSpec(
	memory: Pick<PlannedMemoryDeclaration, 'elementWordSize' | 'isInteger' | 'isUnsigned'>
): TypedValueSpec {
	return getTypeSpec(getMemoryBaseType(memory));
}

/** Describes one pointer dereference; double pointers yield another 32-bit pointer value. */
export function getPointeeValueSpec(
	memory: Pick<PlannedMemoryDeclaration, 'pointeeBaseType' | 'pointerDepth'>
): TypedValueSpec | undefined {
	return memory.pointeeBaseType ? getTypeSpec(memory.pointerDepth > 1 ? 'int' : memory.pointeeBaseType) : undefined;
}
