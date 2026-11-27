import type { GetOrCreateMemoryResult, MemoryAction } from '@8f4e/language-spec';
import { WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import didProgramOrMemoryStructureChange, { type ProgramMemoryStructure } from './didProgramOrMemoryStructureChange';

let memoryRefCache: WebAssembly.Memory | null = null;
let currentMemorySize = 0;

export default function getOrCreateMemory(
	allocatedMemoryBytes: number,
	current: ProgramMemoryStructure,
	previous?: ProgramMemoryStructure
): GetOrCreateMemoryResult {
	const memoryStructureChanged = didProgramOrMemoryStructureChange(current, previous);
	const memorySizeChange = currentMemorySize !== allocatedMemoryBytes;
	const shouldRecreate = !memoryRefCache || memoryStructureChanged || memorySizeChange;
	let memoryAction: MemoryAction;

	if (shouldRecreate) {
		const prevBytes = currentMemorySize;
		// Round up requested bytes to whole wasm pages (64 KiB); WebAssembly.Memory is page-granular.
		const pages = Math.ceil(allocatedMemoryBytes / WASM_MEMORY_PAGE_SIZE);

		memoryRefCache = new WebAssembly.Memory({
			initial: pages,
			maximum: pages,
			shared: true,
		});
		currentMemorySize = allocatedMemoryBytes;

		// Determine the reason for recreation
		if (prevBytes === 0) {
			memoryAction = { action: 'recreated', reason: { kind: 'no-instance' } };
		} else if (memorySizeChange) {
			memoryAction = {
				action: 'recreated',
				reason: { kind: 'memory-size-changed', prevBytes, nextBytes: allocatedMemoryBytes },
			};
		} else {
			// memoryStructureChanged must be true
			memoryAction = { action: 'recreated', reason: { kind: 'memory-structure-changed' } };
		}
	} else {
		// Memory is being reused
		memoryAction = { action: 'reused' };
	}

	return { memoryRef: memoryRefCache!, memoryAction };
}
