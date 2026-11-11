import type { State, TypedValueKind } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { extractElementCountBase, hasElementCountPrefix } from '@8f4e/tokenizer';
import {
	getMemoryValueSpec,
	getPointeeValueSpec,
	type TypedValueSpec,
} from '../features/code-blocks/features/directives/shared/typedValueSpec';
import { type PreparedMemoryAccess, prepareMemoryAccess } from './resolveMemoryIdentifier';
import type { MemoryScope, ResolvedMemoryTarget } from './resolveMemoryTarget';

/** A fixed byte address or a live 32-bit pointer slot, with all element offsets converted to bytes. */
export type PreparedAddressBinding =
	| { kind: 'fixed'; byteAddress: number }
	| { kind: 'pointer'; pointerSlotIndex: number; byteOffset: number };

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

/** Whether the expression itself denotes an address rather than the numeric value stored there. */
export function isAddressAccess({ target, options }: PreparedMemoryAccess): boolean {
	return Boolean(options.showAddress || (target.reference && !options.dereference));
}

/** Prepares &samples, a fixed reference, or a typed pointer slot as an address source. */
export function prepareAddressBinding({ target, options }: PreparedMemoryAccess): PreparedAddressBinding | undefined {
	const { memory, reference } = target;
	const index = options.bufferPointer ?? 0;
	if (options.dereference || (reference && options.showAddress)) return;
	if (reference || options.showAddress)
		return { kind: 'fixed', byteAddress: memory.byteAddress + index * memory.elementWordSize };
	if (memory.pointeeBaseType)
		return { kind: 'pointer', pointerSlotIndex: memory.allocationUnitAddress + index, byteOffset: 0 };
}

/** Reads the current byte address without parsing, declaration lookup, or allocation. */
export function readByteAddress(binding: PreparedAddressBinding, pointers: ArrayLike<number>): number | undefined {
	if (binding.kind === 'fixed') return binding.byteAddress;
	const pointer = pointers[binding.pointerSlotIndex];
	return pointer === undefined ? undefined : (pointer >>> 0) + binding.byteOffset;
}

function prepareRead(address: PreparedAddressBinding, spec: TypedValueSpec): PreparedNumericRead {
	return {
		address,
		spec,
		elementIndex: address.kind === 'fixed' ? address.byteAddress / spec.elementByteSize : undefined,
	};
}

/** Prepares a scalar expression; dereferenced pointers follow live values and other expressions read backing storage. */
export function prepareNumericRead({ target, options }: PreparedMemoryAccess): PreparedNumericRead | undefined {
	const { memory, reference } = target;
	if (reference && options.showAddress) return;
	const index = options.bufferPointer ?? 0;
	const pointee = options.dereference && !reference ? getPointeeValueSpec(memory) : undefined;
	if (pointee)
		return prepareRead(
			{ kind: 'pointer', pointerSlotIndex: memory.allocationUnitAddress, byteOffset: index * pointee.elementByteSize },
			pointee
		);
	const spec = getMemoryValueSpec(memory);
	return prepareRead({ kind: 'fixed', byteAddress: memory.byteAddress + index * spec.elementByteSize }, spec);
}

/** Prepares samples at an address source, following a typed pointer's first pointee. */
export function prepareAddressedRead(access: PreparedMemoryAccess): PreparedNumericRead | undefined {
	const address = prepareAddressBinding(access);
	if (!address) return;
	const spec =
		address.kind === 'fixed' ? getMemoryValueSpec(access.target.memory) : getPointeeValueSpec(access.target.memory);
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
