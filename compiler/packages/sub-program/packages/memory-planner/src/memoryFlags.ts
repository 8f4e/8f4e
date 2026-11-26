import type { PointeeBaseType } from '@8f4e/language-spec';
import { BASE_TYPE_METADATA } from '@8f4e/language-spec';

/**
 * Builds semantic memory flags from a base type and pointer depth.
 *
 * @param baseType - Memory base type to encode.
 * @param pointerDepth - Pointer depth to encode.
 * @returns Resolved memory flags.
 */
export default function getMemoryFlags(baseType: PointeeBaseType, pointerDepth: number) {
	const isPointer = pointerDepth > 0;
	const isInteger = BASE_TYPE_METADATA[baseType].isInteger || isPointer;
	const isFloat64 = baseType === 'float64' && !isPointer;
	let pointeeBaseType: PointeeBaseType | undefined;
	if (isPointer) {
		pointeeBaseType = baseType;
	}

	return {
		pointerDepth,
		isInteger,
		...(isFloat64 ? { isFloat64 } : {}),
		...(pointeeBaseType !== undefined ? { pointeeBaseType } : {}),
		isUnsigned: false,
	};
}
