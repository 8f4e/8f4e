export { default as getCodeBlockMemoryScope } from './memory/getCodeBlockMemoryScope';
export {
	getMemoryDefaultEdits,
	type MemoryDefaultEdit,
	type MemoryDefaultValue,
} from './memory/getMemoryDefaultEdits';
export { default as getMemoryTargetAtSourceLine } from './memory/getMemoryTargetAtSourceLine';
export {
	isAddressAccess,
	type NumericMemoryViews,
	type PreparedAddressBinding,
	type PreparedBuffer,
	type PreparedElementCount,
	type PreparedNumericRead,
	prepareAddressBinding,
	prepareAddressedRead,
	prepareBuffer,
	prepareElementCount,
	prepareNumericRead,
	readByteAddress,
	readDeclarationEndAddress,
	readElementCount,
	readElementIndex,
	readNumericValue,
} from './memory/preparedMemory';
export { getProjectGroupMemoryExposures } from './memory/projectGroupMemoryExposures';
export {
	default as resolveMemoryIdentifier,
	getDeclarationsByByteAddress,
	type MemoryAccessOptions,
	type PreparedMemoryAccess,
	prepareMemoryAccess,
	type ResolvedMemoryAccess,
	resolveMemoryAccess,
	resolveMemoryAddress,
} from './memory/resolveMemoryIdentifier';
export type { MemoryScope, ResolvedMemoryTarget } from './memory/resolveMemoryTarget';
export { default as resolveMemoryTarget } from './memory/resolveMemoryTarget';
export {
	getMemoryValueSpec,
	getPointeeValueSpec,
	type TypedValueSpec,
} from './memory/typedValueSpec';
