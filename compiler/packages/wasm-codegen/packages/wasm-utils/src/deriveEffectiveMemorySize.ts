import { WASM_MEMORY_PAGE_SIZE } from './consts';

/**
 * Derives the effective memory size from a required memory footprint.
 * Rounds up to the nearest WebAssembly page boundary (64 KiB) with a minimum of one page.
 *
 * @param requiredBytes - The required memory footprint in bytes
 * @returns The effective memory size in bytes (page-aligned, minimum 1 page)
 */
export function deriveEffectiveMemorySize(requiredBytes: number): number {
	const pages = Math.ceil(requiredBytes / WASM_MEMORY_PAGE_SIZE);
	const effectivePages = Math.max(1, pages);
	return effectivePages * WASM_MEMORY_PAGE_SIZE;
}
