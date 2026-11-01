import type { MemoryPointerMetadata, MemoryValueKind, PlannedMemoryDeclaration } from './memory';
import { BASE_TYPE_METADATA } from './memory';

export type PointerMetadata = Pick<PlannedMemoryDeclaration, 'pointeeBaseType' | 'pointerDepth'> &
	MemoryPointerMetadata;

function getDeclaredBaseTypeMetadata(
	memoryItem: Pick<PlannedMemoryDeclaration, 'elementWordSize' | 'isInteger' | 'isUnsigned'>
) {
	if (memoryItem.isInteger) {
		if (memoryItem.elementWordSize === BASE_TYPE_METADATA.int8.wordSize) {
			return memoryItem.isUnsigned ? BASE_TYPE_METADATA.int8u : BASE_TYPE_METADATA.int8;
		}
		if (memoryItem.elementWordSize === BASE_TYPE_METADATA.int16.wordSize) {
			return memoryItem.isUnsigned ? BASE_TYPE_METADATA.int16u : BASE_TYPE_METADATA.int16;
		}
		return BASE_TYPE_METADATA.int;
	}

	return memoryItem.elementWordSize === BASE_TYPE_METADATA.float64.wordSize
		? BASE_TYPE_METADATA.float64
		: BASE_TYPE_METADATA.float;
}

function getPointeeBaseTypeMetadata(pointeeBaseType: NonNullable<PointerMetadata['pointeeBaseType']>) {
	return BASE_TYPE_METADATA[pointeeBaseType];
}

export function getPointerDepthFromMetadata(pointerMetadata: PointerMetadata | undefined): number {
	if (!pointerMetadata?.pointeeBaseType) return 0;
	return pointerMetadata.pointerDepth;
}

export function getElementCount(memoryItem: PlannedMemoryDeclaration): number {
	return memoryItem.numberOfElements;
}

export function getElementWordSize(memoryItem: PlannedMemoryDeclaration): number {
	return memoryItem.elementWordSize;
}

export function getPointeeElementWordSizeFromMetadata(pointerMetadata: PointerMetadata | undefined): number {
	if (!pointerMetadata?.pointeeBaseType) return 0;
	if (getPointerDepthFromMetadata(pointerMetadata) > 1) return BASE_TYPE_METADATA.pointer.wordSize;
	return getPointeeBaseTypeMetadata(pointerMetadata.pointeeBaseType).wordSize;
}

export function getPointeeElementWordSize(memoryItem: PointerMetadata | undefined): number {
	return getPointeeElementWordSizeFromMetadata(memoryItem);
}

export function getPointeeElementIsIntegerFromMetadata(pointerMetadata: PointerMetadata | undefined): boolean {
	if (!pointerMetadata?.pointeeBaseType) return false;
	if (getPointerDepthFromMetadata(pointerMetadata) > 1) return BASE_TYPE_METADATA.pointer.isInteger;
	return getPointeeBaseTypeMetadata(pointerMetadata.pointeeBaseType).isInteger;
}

export function getDereferencedValueWordSizeFromMetadata(
	pointerMetadata: PointerMetadata | undefined,
	dereferenceDepth = getPointerDepthFromMetadata(pointerMetadata)
): number {
	if (!pointerMetadata?.pointeeBaseType) return 0;
	if (dereferenceDepth < getPointerDepthFromMetadata(pointerMetadata)) return BASE_TYPE_METADATA.pointer.wordSize;
	return getPointeeBaseTypeMetadata(pointerMetadata.pointeeBaseType).wordSize;
}

export function getDereferencedValueKindFromMetadata(
	pointerMetadata: PointerMetadata | undefined,
	dereferenceDepth = getPointerDepthFromMetadata(pointerMetadata)
): MemoryValueKind {
	if (!pointerMetadata?.pointeeBaseType) return 'float32';
	if (dereferenceDepth < getPointerDepthFromMetadata(pointerMetadata)) return BASE_TYPE_METADATA.pointer.valueKind;
	return getPointeeBaseTypeMetadata(pointerMetadata.pointeeBaseType).valueKind;
}

export function getElementMaxValue(memoryItem: PlannedMemoryDeclaration): number {
	const metadata = getDeclaredBaseTypeMetadata(memoryItem);
	return memoryItem.isUnsigned ? (metadata.unsignedMax ?? metadata.max) : metadata.max;
}

export function getPointeeElementMaxValueFromMetadata(pointerMetadata: PointerMetadata | undefined): number {
	if (!pointerMetadata?.pointeeBaseType) return 0;
	if (getPointerDepthFromMetadata(pointerMetadata) > 1) return BASE_TYPE_METADATA.pointer.max;
	return getPointeeBaseTypeMetadata(pointerMetadata.pointeeBaseType).max;
}

export function getPointeeElementMaxValue(memoryItem: PointerMetadata | undefined): number {
	return getPointeeElementMaxValueFromMetadata(memoryItem);
}

export function getElementMinValue(memoryItem: PlannedMemoryDeclaration): number {
	const metadata = getDeclaredBaseTypeMetadata(memoryItem);
	return memoryItem.isUnsigned ? (metadata.unsignedMin ?? metadata.min) : metadata.min;
}

export function getPointeeElementMinValueFromMetadata(pointerMetadata: PointerMetadata | undefined): number {
	if (!pointerMetadata?.pointeeBaseType) return 0;
	if (getPointerDepthFromMetadata(pointerMetadata) > 1) return BASE_TYPE_METADATA.pointer.min;
	return getPointeeBaseTypeMetadata(pointerMetadata.pointeeBaseType).min;
}

export function getPointeeElementMinValue(memoryItem: PointerMetadata | undefined): number {
	return getPointeeElementMinValueFromMetadata(memoryItem);
}
