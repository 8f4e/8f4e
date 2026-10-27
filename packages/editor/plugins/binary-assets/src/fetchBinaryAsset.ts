const CACHE_NAME = '8f4e-binary-assets';

export default async function fetchBinaryAsset(url: string): Promise<{ data: ArrayBuffer; fileName: string }> {
	const cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE_NAME);
	const cached = await cache?.match(url);
	const response = cached ?? (await fetch(url));
	if (!response.ok) throw new Error(`Failed to fetch binary asset: ${url} (${response.status})`);
	if (cache && !cached) await cache.put(url, response.clone());

	const fileName = new URL(url, globalThis.location?.href).pathname.split('/').filter(Boolean).at(-1) ?? 'binary-asset';
	return { data: await response.arrayBuffer(), fileName };
}
