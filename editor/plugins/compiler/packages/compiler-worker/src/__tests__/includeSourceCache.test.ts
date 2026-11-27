import { describe, expect, it, vi } from 'vitest';
import { createIncludeSourceCache } from '../includeSourceCache';

describe('createIncludeSourceCache', () => {
	it('reuses resolved and in-flight include requests across compilations', async () => {
		const cache = createIncludeSourceCache();
		let finishLoading: ((source: string) => void) | undefined;
		const load = vi.fn(
			() =>
				new Promise<string>(resolve => {
					finishLoading = resolve;
				})
		);

		const first = cache.resolve('std/math/sine', load);
		const concurrent = cache.resolve('std/math/sine', load);
		await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
		finishLoading?.('function sine\nfunctionEnd');

		await expect(first).resolves.toBe('function sine\nfunctionEnd');
		await expect(concurrent).resolves.toBe('function sine\nfunctionEnd');
		await expect(cache.resolve('std/math/sine', load)).resolves.toBe('function sine\nfunctionEnd');
		expect(load).toHaveBeenCalledOnce();
	});

	it('retries an include after its source request rejects', async () => {
		const cache = createIncludeSourceCache();
		const load = vi.fn().mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce('source');

		await expect(cache.resolve('std/retry', load)).rejects.toThrow('temporary failure');
		await expect(cache.resolve('std/retry', load)).resolves.toBe('source');
		expect(load).toHaveBeenCalledTimes(2);
	});
});
