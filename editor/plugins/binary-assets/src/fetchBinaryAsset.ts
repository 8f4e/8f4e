const CACHE_NAME = '8f4e-binary-assets';

export default async function fetchBinaryAsset(
	url: string,
	signal?: AbortSignal
): Promise<{ data: ArrayBuffer; fileName: string }> {
	signal?.throwIfAborted();
	let cache: Cache | undefined;
	let data: ArrayBuffer | undefined;
	try {
		cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE_NAME);
		const cached = await cache?.match(url);
		if (cached?.ok) data = await cached.arrayBuffer();
	} catch {
		// Cache access is optional; fall back to the network if storage cannot be read.
		cache = undefined;
	}
	signal?.throwIfAborted();
	if (data === undefined) {
		const response = await fetch(url, { signal });
		if (!response.ok) throw new Error(`Failed to fetch binary asset: ${url} (${response.status})`);
		if (cache) {
			try {
				await cache.put(url, response.clone());
			} catch {
				// A failed cache write must not discard a usable network response.
			}
		}
		signal?.throwIfAborted();
		data = await response.arrayBuffer();
	}
	signal?.throwIfAborted();

	const fileName = new URL(url, globalThis.location?.href).pathname.split('/').filter(Boolean).at(-1) ?? 'binary-asset';
	return { data, fileName };
}
