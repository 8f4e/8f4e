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

	it.each(['opening', 'matching', 'reading', 'writing'])('loads network bytes when %s the cache fails', async stage => {
		const error = new DOMException('Storage unavailable', 'QuotaExceededError');
		const cached = new Response(new Uint8Array([9]));
		if (stage === 'reading') vi.spyOn(cached, 'arrayBuffer').mockRejectedValue(error);
		const match = vi.fn().mockResolvedValue(stage === 'reading' ? cached : undefined);
		const put = vi.fn().mockResolvedValue(undefined);
		const open = vi.fn().mockResolvedValue({ match, put });
		if (stage === 'opening') open.mockRejectedValue(error);
		if (stage === 'matching') match.mockRejectedValue(error);
		if (stage === 'writing') put.mockRejectedValue(error);
		const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([3, 4])));
		vi.stubGlobal('caches', { open });
		vi.stubGlobal('fetch', fetchMock);
		const asset = await fetchBinaryAsset('https://example.com/sample.pcm');
		expect([...new Uint8Array(asset.data)]).toEqual([3, 4]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('preserves network failures when the cache is unavailable', async () => {
		const error = new Error('offline');
		vi.stubGlobal('caches', { open: vi.fn().mockRejectedValue(new Error('Storage unavailable')) });
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
		await expect(fetchBinaryAsset('https://example.com/sample.pcm')).rejects.toBe(error);
	});

	it('does not start a network request if cancelled during a cache lookup', async () => {
		let finish!: (response: Response | undefined) => void;
		const match = vi.fn(() => new Promise<Response | undefined>(resolve => (finish = resolve)));
		const fetchMock = vi.fn();
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match }) });
		vi.stubGlobal('fetch', fetchMock);
		const controller = new AbortController();
		const result = fetchBinaryAsset('https://example.com/sample.pcm', controller.signal);
		await vi.waitFor(() => expect(match).toHaveBeenCalledOnce());
		controller.abort();
		finish(undefined);
		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('passes cancellation to fetch and rejects bytes read after cancellation', async () => {
		let finish!: (data: ArrayBuffer) => void;
		const response = new Response();
		const read = vi.spyOn(response, 'arrayBuffer').mockImplementation(() => new Promise(resolve => (finish = resolve)));
		const fetchMock = vi.fn().mockResolvedValue(response);
		vi.stubGlobal('caches', undefined);
		vi.stubGlobal('fetch', fetchMock);
		const controller = new AbortController();
		const result = fetchBinaryAsset('https://example.com/sample.pcm', controller.signal);
		await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://example.com/sample.pcm', { signal: controller.signal });
		controller.abort();
		finish(new ArrayBuffer(2));
		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('rejects unsuccessful HTTP responses without caching them', async () => {
		const put = vi.fn();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
		vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: vi.fn().mockResolvedValue(undefined), put }) });
		await expect(fetchBinaryAsset('https://example.com/missing.bin')).rejects.toThrow('404');
		expect(put).not.toHaveBeenCalled();
	});
});
