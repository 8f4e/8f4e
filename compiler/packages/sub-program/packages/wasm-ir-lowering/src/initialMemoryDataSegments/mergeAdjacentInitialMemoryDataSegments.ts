import materializeByteChunks from './materializeByteChunks';

import type { InitialMemoryDataSegment } from './types';

/** Maximum zero-filled gap to fold between neighboring passive data segments. */
export const MAX_ZERO_GAP_BYTES_TO_MERGE = 32;

/**
 * Sorts and merges compatible initial memory data segments, filling small gaps with zeros.
 *
 * @param segments - Initial memory data segments to merge.
 * @returns The materialized initial memory data segment data.
 */
export default function mergeAdjacentInitialMemoryDataSegments(
	segments: InitialMemoryDataSegment[]
): InitialMemoryDataSegment[] {
	const mergedSegments: InitialMemoryDataSegment[] = [];
	let segmentByteAddress = 0;
	let segmentByteLength = 0;
	let segmentChunks: Array<Uint8Array | number> = [];
	let nextSegmentByteAddress: number | undefined;

	const flushSegment = () => {
		if (segmentChunks.length === 0) {
			return;
		}

		mergedSegments.push({
			byteAddress: segmentByteAddress,
			bytes: materializeByteChunks(segmentChunks, segmentByteLength),
		});
		segmentByteLength = 0;
		segmentChunks = [];
		nextSegmentByteAddress = undefined;
	};

	for (const segment of [...segments].sort((left, right) => left.byteAddress - right.byteAddress)) {
		const gapByteLength = nextSegmentByteAddress === undefined ? 0 : segment.byteAddress - nextSegmentByteAddress;

		if (segmentChunks.length === 0 || gapByteLength > MAX_ZERO_GAP_BYTES_TO_MERGE) {
			flushSegment();
			segmentByteAddress = segment.byteAddress;
		} else if (gapByteLength > 0) {
			segmentChunks.push(gapByteLength);
			segmentByteLength += gapByteLength;
		}

		segmentChunks.push(segment.bytes);
		segmentByteLength += segment.bytes.length;
		nextSegmentByteAddress = segment.byteAddress + segment.bytes.length;
	}

	flushSegment();

	return mergedSegments;
}
