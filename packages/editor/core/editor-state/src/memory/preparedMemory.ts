import type { State, TypedValueKind } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { extractElementCountBase, hasElementCountPrefix } from '@8f4e/tokenizer';
import {
	getStorageDereferenceDepth,
	isAddressAccess,
	type PreparedAddressBinding,
	prepareStorageAddress,
	readByteAddress,
} from './memoryAddressBinding';
import { type PreparedMemoryAccess, prepareMemoryAccess } from './resolveMemoryIdentifier';
import type { MemoryScope, ResolvedMemoryTarget } from './resolveMemoryTarget';
import { getMemoryValueSpec, getPointeeValueSpec, type TypedValueSpec } from './typedValueSpec';

export { isAddressAccess, type PreparedAddressBinding, readByteAddress } from './memoryAddressBinding';

/** Only numeric views; ownership and allocation remain with the runtime/renderer. */
export type NumericMemoryViews = Readonly<Record<TypedValueKind, ArrayLike<number>>>;

export interface PreparedNumericRead {
	address: PreparedAddressBinding;
	spec: TypedValueSpec;
	/** Typed-element index for static storage; live pointers derive it from their current byte address. */
	elementIndex?: number;
}

export type PreparedElementCount = number | PreparedNumericRead;

export interface PreparedBuffer {
	/** Original public identity and backing declaration/module, including fixed-reference metadata. */
	target: ResolvedMemoryTarget;
	samples: PreparedNumericRead;
	elementCount: PreparedElementCount;
}

/** Prepares the address of an allocation or the address stored in a pointer-valued expression. */
export function prepareAddressBinding(access: PreparedMemoryAccess): PreparedAddressBinding | undefined {
	const depth = getStorageDereferenceDepth(access);
	if (depth === undefined) return;

	const {
		target: { memory },
		options,
	} = access;
	const index = options.bufferPointer ?? 0;
	if (isAddressAccess(access)) return prepareStorageAddress(memory, depth, index * memory.elementWordSize);
	if (depth === memory.pointerDepth) return;

	// For address sources the index selects the pointer element to load.
	return depth === 0
		? { kind: 'pointer', pointerSlotIndex: memory.allocationUnitAddress + index, byteOffset: 0 }
		: {
				kind: 'indirect',
				pointerSlotIndex: memory.allocationUnitAddress,
				pointerByteOffset: index * memory.elementWordSize,
				byteOffset: 0,
			};
}

function prepareRead(address: PreparedAddressBinding, spec: TypedValueSpec): PreparedNumericRead {
	return {
		address,
		spec,
		elementIndex: address.kind === 'fixed' ? address.byteAddress / spec.elementByteSize : undefined,
	};
}

/** Prepares a scalar expression; dereferenced pointers follow live values and other expressions read backing storage. */
export function prepareNumericRead(access: PreparedMemoryAccess): PreparedNumericRead | undefined {
	const depth = getStorageDereferenceDepth(access);
	if (depth === undefined) return;

	const {
		target: { memory },
		options,
	} = access;
	const spec = depth === 0 ? getMemoryValueSpec(memory) : getPointeeValueSpec(memory, depth);
	if (!spec) return;
	const offset = (options.bufferPointer ?? 0) * spec.elementByteSize;
	return prepareRead(prepareStorageAddress(memory, depth, offset), spec);
}

/** Prepares samples at an address source, including the final pointee of an explicitly dereferenced double pointer. */
export function prepareAddressedRead(access: PreparedMemoryAccess): PreparedNumericRead | undefined {
	const address = prepareAddressBinding(access);
	if (!address) return;
	const spec =
		address.kind === 'fixed'
			? getMemoryValueSpec(access.target.memory)
			: getPointeeValueSpec(access.target.memory, address.kind === 'indirect' ? 2 : 1);
	return spec && prepareRead(address, spec);
}

/** Converts byte addresses into typed-element indices, reusing the prepared index for fixed storage. */
export function readElementIndex(read: PreparedNumericRead, pointers: ArrayLike<number>): number | undefined {
	if (read.elementIndex !== undefined) return read.elementIndex;
	const address = readByteAddress(read.address, pointers);
	return address === undefined ? undefined : address / read.spec.elementByteSize;
}

/** Reads one typed value from current views without retaining views or allocating a result object. */
export function readNumericValue(read: PreparedNumericRead, memory: NumericMemoryViews): number | undefined {
	const index = readElementIndex(read, memory.int32);
	return index === undefined ? undefined : memory[read.spec.valueType][index];
}

/** Prepares a positive literal, count(declaration), or live numeric count using its declared storage type. */
export function prepareElementCount(
	state: Pick<State, 'compiler'>,
	scope: MemoryScope,
	count: number | string | undefined
): PreparedElementCount | undefined {
	if (typeof count === 'number') return count > 0 ? count : undefined;
	if (!count) return;
	if (hasElementCountPrefix(count))
		return prepareMemoryAccess(state, scope, extractElementCountBase(count))?.target.memory.numberOfElements;
	const access = prepareMemoryAccess(state, scope, count);
	return access && prepareNumericRead(access);
}

/** Reads a literal or current live count; zero/negative runtime counts retain their values for the consumer. */
export function readElementCount(count: PreparedElementCount, memory: NumericMemoryViews): number | undefined {
	return typeof count === 'number' ? count : readNumericValue(count, memory);
}

/** Resolves a buffer's source, type and literal/live count together during source/compiler preparation. */
export function prepareBuffer(
	state: Pick<State, 'compiler'>,
	scope: MemoryScope,
	source: string,
	count: number | string
): PreparedBuffer | undefined {
	const access = prepareMemoryAccess(state, scope, source);
	const samples = access && prepareAddressedRead(access);
	const elementCount = prepareElementCount(state, scope, count);
	return access && samples && elementCount !== undefined ? { target: access.target, samples, elementCount } : undefined;
}

/** Reads an already indexed declaration boundary for end-address displays of live pointer targets. */
export function readDeclarationEndAddress(
	address: number | undefined,
	declarations: ReadonlyMap<number, PlannedMemoryDeclaration>
): number | undefined {
	return address === undefined ? undefined : declarations.get(address)?.endByteAddress;
}
