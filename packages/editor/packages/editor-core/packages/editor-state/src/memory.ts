export {
	getMemoryValueSpec,
	getPointeeValueSpec,
	type TypedValueSpec,
} from './features/code-blocks/features/directives/shared/typedValueSpec';
export { default as getCodeBlockMemoryScope } from './pureHelpers/getCodeBlockMemoryScope';
export {
	getMemoryDefaultEdits,
	type MemoryDefaultEdit,
	type MemoryDefaultValue,
} from './pureHelpers/getMemoryDefaultEdits';
export { default as getMemoryTargetAtSourceLine } from './pureHelpers/getMemoryTargetAtSourceLine';
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
} from './pureHelpers/preparedMemory';
export {
	default as resolveMemoryIdentifier,
	getDeclarationsByByteAddress,
	type MemoryAccessOptions,
	type PreparedMemoryAccess,
	prepareMemoryAccess,
	type ResolvedMemoryAccess,
	resolveMemoryAccess,
	resolveMemoryAddress,
} from './pureHelpers/resolveMemoryIdentifier';
export type { MemoryScope, ResolvedMemoryTarget } from './pureHelpers/resolveMemoryTarget';
export { default as resolveMemoryTarget } from './pureHelpers/resolveMemoryTarget';
