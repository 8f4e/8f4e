import { describe, expect, test } from 'vitest';

import { createWasmVersion } from './wasmVersion';

describe('createWasmVersion', () => {
	test('encodes WebAssembly version numbers as uint32 little-endian bytes', () => {
		expect(createWasmVersion(1)).toEqual([0x01, 0x00, 0x00, 0x00]);
		expect(createWasmVersion(0x01020304)).toEqual([0x04, 0x03, 0x02, 0x01]);
	});
});
