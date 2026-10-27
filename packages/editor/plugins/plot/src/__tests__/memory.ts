import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
export function createMemory(overrides: Partial<PlannedMemoryDeclaration>): PlannedMemoryDeclaration {
	return {
		id: 'value',
		type: 'int',
		numberOfElements: 1,
		elementWordSize: 4,
		elementByteLength: 4,
		byteAddress: 0,
		allocationUnitAddress: 0,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		endByteAddress: 0,
		endAddressSafeByteLength: 4,
		lineNumber: 0,
		isInteger: true,
		isUnsigned: false,
		pointerDepth: 0,
		...overrides,
	};
}
