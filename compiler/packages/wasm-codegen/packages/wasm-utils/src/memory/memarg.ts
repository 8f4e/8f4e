import unsignedLEB128 from '../encoding/unsignedLEB128';

/** Encodes a memory instruction's alignment exponent and byte offset. */
export default function memarg(alignment: number, offset: number): number[] {
	return [...unsignedLEB128(alignment), ...unsignedLEB128(offset)];
}
