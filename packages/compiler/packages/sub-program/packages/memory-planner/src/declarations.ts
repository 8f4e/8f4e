import type {
	ArrayDeclarationInstruction,
	MemoryType,
	PointeeBaseType,
	ScalarMemoryDeclarationInstruction,
} from '@8f4e/language-spec';
import { ALLOCATION_UNIT_BYTE_SIZE } from '@8f4e/language-spec';
import {
	alignAbsoluteAllocationUnitOffset,
	getAbsoluteAllocationUnitOffset,
	getAllocatedByteLength,
	getByteAddressFromAllocationUnitOffset,
	getEndAddressSafeByteLength,
	getEndByteAddress,
} from './layoutAddresses';
import getMemoryFlags from './memoryFlags';

function getPointerDepth(instruction: string): number {
	return instruction.endsWith('**') || instruction.includes('**[]') ? 2 : instruction.includes('*') ? 1 : 0;
}

function getScalarBaseType(instruction: ScalarMemoryDeclarationInstruction): PointeeBaseType {
	return instruction.replace(/\*+$/, '') as PointeeBaseType;
}

function getArrayElementWordSize(instruction: ArrayDeclarationInstruction): number {
	if (instruction.startsWith('float64') && !instruction.includes('*')) return 8;
	if (instruction.includes('8')) return 1;
	if (instruction.includes('16')) return 2;
	return 4;
}

function getArrayPointeeBaseType(instruction: ArrayDeclarationInstruction): PointeeBaseType | undefined {
	if (!instruction.includes('*')) {
		return undefined;
	}
	if (instruction.startsWith('float64')) {
		return 'float64';
	}
	if (instruction.startsWith('int')) {
		return 'int';
	}
	return 'float';
}

/**
 * Plans address and size metadata for a scalar or pointer declaration.
 *
 * @param input - Declaration layout facts already resolved by the compiler.
 * @returns The planned declaration and updated local allocation-unit offset.
 */
export function planScalarDeclarationLayout(input: {
	id: string;
	lineNumber: number;
	startingByteAddress: number;
	localAllocationUnitOffset: number;
	instruction: ScalarMemoryDeclarationInstruction;
}) {
	const pointerDepth = getPointerDepth(input.instruction);
	const baseType = getScalarBaseType(input.instruction);
	const flags = getMemoryFlags(baseType, pointerDepth);
	const nonPointerElementWordSize = baseType === 'float64' ? 8 : 4;

	if (pointerDepth > 0 || nonPointerElementWordSize === 4) {
		const numberOfElements = 1;
		const elementWordSize = 4;
		const allocationUnitCount = 1;
		const byteAddress = getByteAddressFromAllocationUnitOffset(
			input.startingByteAddress,
			input.localAllocationUnitOffset
		);
		return {
			declaration: {
				numberOfElements,
				elementWordSize,
				allocationUnitAddress: getAbsoluteAllocationUnitOffset(
					input.startingByteAddress,
					input.localAllocationUnitOffset
				),
				allocationUnitCount,
				allocatedByteLength: getAllocatedByteLength(allocationUnitCount),
				byteAddress,
				elementByteLength: numberOfElements * elementWordSize,
				endByteAddress: getEndByteAddress(byteAddress, allocationUnitCount),
				endAddressSafeByteLength: getEndAddressSafeByteLength(allocationUnitCount),
				id: input.id,
				lineNumber: input.lineNumber,
				type: input.instruction,
				...flags,
			},
			nextLocalAllocationUnitOffset: input.localAllocationUnitOffset + allocationUnitCount,
		};
	}

	const numberOfElements = 1;
	const absoluteAllocationUnitOffset = getAbsoluteAllocationUnitOffset(
		input.startingByteAddress,
		input.localAllocationUnitOffset
	);
	const alignedAbsoluteAllocationUnitOffset = alignAbsoluteAllocationUnitOffset(
		absoluteAllocationUnitOffset,
		nonPointerElementWordSize
	);
	const alignmentPaddingUnitCount = alignedAbsoluteAllocationUnitOffset - absoluteAllocationUnitOffset;
	const occupiedAllocationUnitCount = nonPointerElementWordSize / ALLOCATION_UNIT_BYTE_SIZE;
	const allocationUnitCount = alignmentPaddingUnitCount + occupiedAllocationUnitCount;
	const byteAddress = getByteAddressFromAllocationUnitOffset(0, alignedAbsoluteAllocationUnitOffset);

	return {
		declaration: {
			numberOfElements,
			elementWordSize: nonPointerElementWordSize,
			allocationUnitAddress: alignedAbsoluteAllocationUnitOffset,
			allocationUnitCount,
			allocatedByteLength: getAllocatedByteLength(occupiedAllocationUnitCount),
			byteAddress,
			elementByteLength: numberOfElements * nonPointerElementWordSize,
			endByteAddress: getEndByteAddress(byteAddress, occupiedAllocationUnitCount),
			endAddressSafeByteLength: getEndAddressSafeByteLength(occupiedAllocationUnitCount),
			id: input.id,
			lineNumber: input.lineNumber,
			type: input.instruction,
			...flags,
		},
		nextLocalAllocationUnitOffset: input.localAllocationUnitOffset + allocationUnitCount,
	};
}

/**
 * Plans address and size metadata for an array declaration.
 *
 * @param input - Declaration layout facts already resolved by the compiler.
 * @returns The planned declaration and updated local allocation-unit offset.
 */
export function planArrayDeclarationLayout(input: {
	id: string;
	lineNumber: number;
	startingByteAddress: number;
	localAllocationUnitOffset: number;
	instruction: ArrayDeclarationInstruction;
	numberOfElements: number;
}) {
	const elementWordSize = getArrayElementWordSize(input.instruction);
	const pointerDepth = getPointerDepth(input.instruction);
	const absoluteAllocationUnitOffset = getAbsoluteAllocationUnitOffset(
		input.startingByteAddress,
		input.localAllocationUnitOffset
	);
	const alignedAbsoluteAllocationUnitOffset = alignAbsoluteAllocationUnitOffset(
		absoluteAllocationUnitOffset,
		elementWordSize
	);
	const alignmentPaddingUnitCount = alignedAbsoluteAllocationUnitOffset - absoluteAllocationUnitOffset;
	const occupiedAllocationUnitCount = Math.ceil((input.numberOfElements * elementWordSize) / ALLOCATION_UNIT_BYTE_SIZE);
	const allocationUnitCount = alignmentPaddingUnitCount + occupiedAllocationUnitCount;
	const pointeeBaseType = getArrayPointeeBaseType(input.instruction);
	const byteAddress = getByteAddressFromAllocationUnitOffset(0, alignedAbsoluteAllocationUnitOffset);

	return {
		declaration: {
			numberOfElements: input.numberOfElements,
			elementWordSize,
			allocationUnitCount,
			allocatedByteLength: getAllocatedByteLength(occupiedAllocationUnitCount),
			allocationUnitAddress: alignedAbsoluteAllocationUnitOffset,
			id: input.id,
			lineNumber: input.lineNumber,
			byteAddress,
			elementByteLength: input.numberOfElements * elementWordSize,
			endByteAddress: getEndByteAddress(byteAddress, occupiedAllocationUnitCount),
			endAddressSafeByteLength: getEndAddressSafeByteLength(occupiedAllocationUnitCount),
			isInteger: input.instruction.startsWith('int') || input.instruction.includes('*'),
			...(input.instruction === 'float64[]' ? { isFloat64: true } : {}),
			pointerDepth,
			...(pointeeBaseType ? { pointeeBaseType } : {}),
			type: input.instruction.slice(0, -2) as MemoryType,
			isUnsigned: input.instruction.endsWith('u[]'),
		},
		nextLocalAllocationUnitOffset: input.localAllocationUnitOffset + allocationUnitCount,
	};
}
