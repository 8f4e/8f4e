/** Byte payload or zero-filled gap length used while assembling data segments. */
export type ByteChunk = Uint8Array | number;

/**
 * Materializes byte chunks and zero-filled gaps into one contiguous byte array.
 *
 * @param chunks - Byte chunks to merge into a contiguous buffer.
 * @param byteLength - Number of bytes to materialize or validate.
 * @returns The computed result.
 */
export default function materializeByteChunks(chunks: ByteChunk[], byteLength: number): Uint8Array {
	const bytes = new Uint8Array(byteLength);
	let byteOffset = 0;

	for (const chunk of chunks) {
		if (typeof chunk === 'number') {
			byteOffset += chunk;
			continue;
		}

		bytes.set(chunk, byteOffset);
		byteOffset += chunk.length;
	}

	return bytes;
}
