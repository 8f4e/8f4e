import { afterEach, describe, expect, it, vi } from 'vitest';
import fetchBinaryAsset from './fetchBinaryAsset';

afterEach(() => vi.unstubAllGlobals());

describe('binary asset fetching and caching', () => {
	it('uses cached bytes without a network request', async () => {
		const fetchMock = vi.fn();
		const match = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2])));
		const put = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match, put }) });
		const asset = await fetchBinaryAsset('https://example.com/sample.pcm');
		expect([...new Uint8Array(asset.data)]).toEqual([1, 2]);
		expect(asset.fileName).toBe('sample.pcm');
		expect(fetchMock).not.toHaveBeenCalled();
		expect(put).not.toHaveBeenCalled();
	});

	it('stores a network response in the cache', async () => {
		const put = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([3, 4]))));
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: vi.fn().mockResolvedValue(undefined), put }) });
		const asset = await fetchBinaryAsset('https://example.com/sample.pcm');
		expect([...new Uint8Array(asset.data)]).toEqual([3, 4]);
		expect(put).toHaveBeenCalledWith('https://example.com/sample.pcm', expect.any(Response));
		expect([...new Uint8Array(await put.mock.calls[0][1].arrayBuffer())]).toEqual([3, 4]);
	});

	it('fetches directly when CacheStorage is unavailable and resolves relative filenames', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([5]))));
		vi.stubGlobal('caches', undefined);
		vi.stubGlobal('location', { href: 'https://example.com/editor/' });
		expect((await fetchBinaryAsset('../sounds/kick.pcm?version=1')).fileName).toBe('kick.pcm');
	});

	it('rejects unsuccessful HTTP responses without caching them', async () => {
		const put = vi.fn();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: vi.fn().mockResolvedValue(undefined), put }) });
		await expect(fetchBinaryAsset('https://example.com/missing.bin')).rejects.toThrow('404');
		expect(put).not.toHaveBeenCalled();
	});
});
