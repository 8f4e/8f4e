import { ALLOCATION_UNIT_BYTE_SIZE, type PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { PreparedMemoryAccess } from './resolveMemoryIdentifier';

/** A fixed address or up to two live pointer loads with byte offsets. */
export type PreparedAddressBinding =
	| { kind: 'fixed'; byteAddress: number }
	| { kind: 'pointer'; pointerSlotIndex: number; byteOffset: number }
	| { kind: 'indirect'; pointerSlotIndex: number; pointerByteOffset: number; byteOffset: number };

/** Whether the expression denotes an address rather than a stored value. */
export function isAddressAccess({ target, options }: PreparedMemoryAccess): boolean {
	return Boolean(options.showAddress || (target.reference && !options.dereferenceDepth));
}

/** A reference's first dereference selects its backing allocation without a runtime pointer load. */
export function getStorageDereferenceDepth({ target, options }: PreparedMemoryAccess): number | undefined {
	if (target.reference && options.showAddress) return;
	const depth = options.dereferenceDepth ?? 0;
	const pointerLoads = target.reference && depth > 0 ? depth - 1 : depth;
	return pointerLoads <= target.memory.pointerDepth ? pointerLoads : undefined;
}

/** Applies an offset to the address reached after following the requested number of live pointers. */
export function prepareStorageAddress(
	memory: PlannedMemoryDeclaration,
	pointerLoads: number,
	byteOffset = 0
): PreparedAddressBinding {
	const pointerSlotIndex = memory.allocationUnitAddress;
	switch (pointerLoads) {
		case 0:
			return { kind: 'fixed', byteAddress: memory.byteAddress + byteOffset };
		case 1:
			return { kind: 'pointer', pointerSlotIndex, byteOffset };
		default:
			return { kind: 'indirect', pointerSlotIndex, pointerByteOffset: 0, byteOffset };
	}
}

type PointerWords = ArrayLike<number> | ((index: number) => number | undefined);

/** Reads the current byte address without parsing, declaration lookup, or allocation. */
export function readByteAddress(binding: PreparedAddressBinding, pointers: PointerWords): number | undefined {
	if (binding.kind === 'fixed') return binding.byteAddress;
	const index = binding.pointerSlotIndex;
	const pointer = typeof pointers === 'function' ? pointers(index) : pointers[index];
	if (pointer === undefined) return;
	if (binding.kind === 'pointer') return (pointer >>> 0) + binding.byteOffset;

	const nextIndex = ((pointer >>> 0) + binding.pointerByteOffset) / ALLOCATION_UNIT_BYTE_SIZE;
	if (!Number.isInteger(nextIndex)) return;
	const indirect = typeof pointers === 'function' ? pointers(nextIndex) : pointers[nextIndex];
	return indirect === undefined ? undefined : (indirect >>> 0) + binding.byteOffset;
}
