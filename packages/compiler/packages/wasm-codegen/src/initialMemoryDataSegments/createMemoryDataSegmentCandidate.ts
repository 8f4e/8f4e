import type { MemoryDefault, PlannedMemoryDeclaration } from '@8f4e/language-spec';
import materializeByteChunks from './materializeByteChunks';

import type { InitialMemoryDataSegmentCandidate } from './types';
import writeDefaultValue from './writeDefaultValue';

/**
 * Creates initial data segment candidates for explicit or non-zero memory defaults.
 *
 * @param memory - Planned memory declaration being materialized.
 * @param memoryDefault - Resolved default value for the declaration.
 * @returns The materialized initial memory data segment data.
 */
export default function createMemoryDataSegmentCandidate(
	memory: PlannedMemoryDeclaration,
	memoryDefault: MemoryDefault
): InitialMemoryDataSegmentCandidate[] {
	const isArray = typeof memoryDefault.value === 'object';
	if (isArray && memoryDefault.hasExplicitDefault !== true) {
		return [];
	}
	if (!isArray && memoryDefault.hasExplicitDefault !== true && memoryDefault.value === 0) {
		return [];
	}

	if (isArray) {
		return createArrayDataSegmentCandidates(memory, memoryDefault.value as Record<string, number>);
	}

	const bytes = createDefaultValueBytes(memory, memoryDefault.value as number);
	return [
		{
			byteAddress: memory.byteAddress,
			bytes,
			sourceKind: 'scalar',
		},
	];
}

function createArrayDataSegmentCandidates(
	memory: PlannedMemoryDeclaration,
	defaults: Record<string, number>
): InitialMemoryDataSegmentCandidate[] {
	const segments: InitialMemoryDataSegmentCandidate[] = [];
	let runByteAddress = 0;
	let runByteLength = 0;
	let runChunks: Uint8Array[] = [];
	let nextRunByteAddress: number | undefined;

	const flushRun = () => {
		if (runChunks.length === 0) {
			return;
		}

		segments.push({
			byteAddress: runByteAddress,
			bytes: materializeByteChunks(runChunks, runByteLength),
			sourceKind: 'array',
		});
		runByteLength = 0;
		runChunks = [];
		nextRunByteAddress = undefined;
	};

	for (const { elementIndex, value } of Object.entries(defaults)
		.map(([elementIndex, value]) => ({
			elementIndex: parseInt(elementIndex, 10),
			value,
		}))
		.sort((left, right) => left.elementIndex - right.elementIndex)) {
		// Skip encoding positive zero while preserving floating-point negative zero's sign bit.
		if (Object.is(value, 0)) {
			flushRun();
			continue;
		}

		const bytes = createDefaultValueBytes(memory, value);
		if (bytes.every(byte => byte === 0)) {
			flushRun();
			continue;
		}

		const byteAddress = memory.byteAddress + elementIndex * memory.elementWordSize;
		if (nextRunByteAddress !== byteAddress) {
			flushRun();
			runByteAddress = byteAddress;
		}

		runChunks.push(bytes);
		runByteLength += bytes.length;
		nextRunByteAddress = byteAddress + bytes.length;
	}

	flushRun();

	return segments;
}

function createDefaultValueBytes(memory: PlannedMemoryDeclaration, value: number): Uint8Array {
	const bytes = new Uint8Array(memory.elementWordSize);
	const view = new DataView(bytes.buffer);
	writeDefaultValue(view, memory, 0, value);

	return bytes;
}
