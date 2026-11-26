/**
 * Encodes a WebAssembly binary version number as little-endian bytes.
 *
 * @param version - WebAssembly binary version number.
 * @returns Created wasm version.
 */
export function createWasmVersion(version: number): number[] {
	const value = version >>> 0;

	return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}
