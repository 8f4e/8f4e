import { afterEach, describe, expect, it, vi } from 'vitest';

import createModule from './createModule';

function mockInstantiation(exports: WebAssembly.Exports) {
	vi.spyOn(WebAssembly, 'instantiate').mockResolvedValue({
		instance: { exports } as WebAssembly.Instance,
		module: {} as WebAssembly.Module,
	} as WebAssembly.WebAssemblyInstantiatedSource);
}

describe('createModule', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([
		[undefined, 'main'],
		['alternate', 'alternate'],
	])('selects the configured entry export %s', async (configuredEntry, expectedExport) => {
		const main = vi.fn();
		const alternate = vi.fn();
		mockInstantiation({ main, alternate, initDefaults: vi.fn(), buffer: vi.fn() });

		const result = await createModule(new WebAssembly.Memory({ initial: 1 }), new Uint8Array(), configuredEntry);

		expect(result.entry).toBe(expectedExport === 'main' ? main : alternate);
	});
});
