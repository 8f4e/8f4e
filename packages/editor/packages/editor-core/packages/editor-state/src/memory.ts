export {
	resolveDirectOrPointerTypedValueSpec,
	resolveElementCount,
	resolveTypedValueSpec,
} from './features/code-blocks/features/directives/shared/typedValueSpec';
export { default as getCodeBlockMemoryScope } from './pureHelpers/getCodeBlockMemoryScope';
export {
	getMemoryDefaultEdits,
	type MemoryDefaultEdit,
	type MemoryDefaultValue,
} from './pureHelpers/getMemoryDefaultEdits';
export { default as resolveMemoryIdentifier } from './pureHelpers/resolveMemoryIdentifier';
export type { MemoryScope, ResolvedMemoryTarget } from './pureHelpers/resolveMemoryTarget';
export { default as resolveMemoryTarget } from './pureHelpers/resolveMemoryTarget';
