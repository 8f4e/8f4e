import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import { binaryAssetsEditorConfigSchemaContribution, resolveBinaryAssetLoadRequests } from './config';
import fetchBinaryAsset from './fetchBinaryAsset';

type BinaryAssetSource = Awaited<ReturnType<typeof fetchBinaryAsset>>;

type BinaryAsset = {
	id: string;
	url: string;
	source?: BinaryAssetSource;
	destinations: Array<{ memoryId: string; copiedToMemory: boolean }>;
	downloadLoading?: LoadingIndicatorHandle;
};

export function createBinaryAssetsPlugin({
	getMemoryBytes,
}: {
	getMemoryBytes: () => Uint8Array | undefined;
}): EditorPlugin {
	return {
		id: 'binary-assets',
		setup: ({ store, loading }) => {
			let assets: BinaryAsset[] = [];
			const pendingDownloads = new Map<string, AbortController>();
			let disposed = false;
			let signature = '';

			function finishDownload(asset: BinaryAsset, status: 'done' | 'failed' | 'cancelled') {
				const indicator = asset.downloadLoading;
				asset.downloadLoading = undefined;
				if (status === 'done') indicator?.done();
				else if (status === 'failed') indicator?.fail();
				else indicator?.cancel();
			}

			function copyAssetToMemory(asset: BinaryAsset) {
				if (!asset.source) return;
				const bytes = getMemoryBytes();
				if (bytes) {
					for (const destination of asset.destinations) {
						if (destination.copiedToMemory) continue;
						const memory = resolveMemoryTarget(
							store.getState(),
							{ kind: 'project', groupPath: '' },
							destination.memoryId
						)?.memory;
						if (!memory) continue;
						const length = Math.min(asset.source.data.byteLength, memory.allocatedByteLength);
						if (memory.byteAddress + length > bytes.byteLength) continue;
						bytes.set(new Uint8Array(asset.source.data, 0, length), memory.byteAddress);
						destination.copiedToMemory = true;
					}
				}
			}

			function recopyAssetsToMemory() {
				for (const asset of assets) {
					for (const destination of asset.destinations) destination.copiedToMemory = false;
					copyAssetToMemory(asset);
				}
			}

			function publishConstants() {
				const lines: string[] = [];
				const names = new Set<string>();
				for (const asset of assets) {
					if (!asset.source) continue;
					const name = `ASSET_${asset.id.toUpperCase()}_SIZE`;
					if (names.has(name)) continue;
					names.add(name);
					lines.push(`; '${asset.source.fileName}'`, `const ${name} ${asset.source.data.byteLength}`);
				}
				store.set(
					'envConstantContributions.binaryAssets',
					lines.length ? ['; Binary asset sizes in bytes', ...lines] : []
				);
			}

			async function fetchAssetsForUrl(url: string) {
				const controller = new AbortController();
				pendingDownloads.set(url, controller);
				let source: BinaryAssetSource;
				try {
					source = await fetchBinaryAsset(url, controller.signal);
				} catch (error) {
					if (disposed || controller.signal.aborted) return;
					const matchingAssets = assets.filter(asset => asset.url === url);
					if (!matchingAssets.length) return;
					console.error('Failed to fetch binary asset:', url, error);
					for (const asset of matchingAssets) finishDownload(asset, 'failed');
					return;
				} finally {
					if (pendingDownloads.get(url) === controller) pendingDownloads.delete(url);
				}
				if (disposed || controller.signal.aborted) return;
				const matchingAssets = assets.filter(asset => asset.url === url);
				if (!matchingAssets.length) return;
				for (const asset of matchingAssets) {
					asset.source = source;
					finishDownload(asset, 'done');
				}
				publishConstants();
				if (disposed) return;
				for (const asset of matchingAssets) {
					if (assets.includes(asset)) copyAssetToMemory(asset);
				}
			}

			function syncConfig() {
				const requests = resolveBinaryAssetLoadRequests(store.getState().editorConfig.bin);
				const nextSignature = JSON.stringify(requests);
				if (nextSignature === signature) return;
				signature = nextSignature;
				const previousAssets = new Map(assets.map(asset => [asset.id, asset]));
				const sourcesByUrl = new Map(assets.filter(asset => asset.source).map(asset => [asset.url, asset.source]));
				assets = requests.map(request => {
					const previous = previousAssets.get(request.id);
					const asset: BinaryAsset =
						previous?.url === request.url
							? previous
							: { id: request.id, url: request.url, source: sourcesByUrl.get(request.url), destinations: [] };
					const destinations = new Map(asset.destinations.map(destination => [destination.memoryId, destination]));
					asset.destinations = request.memoryIds.map(
						memoryId => destinations.get(memoryId) ?? { memoryId, copiedToMemory: false }
					);
					return asset;
				});
				for (const asset of previousAssets.values()) {
					if (!assets.includes(asset)) finishDownload(asset, 'cancelled');
				}
				const activeUrls = new Set(assets.map(asset => asset.url));
				for (const [url, controller] of pendingDownloads) {
					if (activeUrls.has(url)) continue;
					pendingDownloads.delete(url);
					controller.abort();
				}
				for (const asset of assets) {
					if (!asset.source && previousAssets.get(asset.id) !== asset) {
						asset.downloadLoading = loading.add({ id: `asset:${asset.id}`, message: `Loading ${asset.id}...` });
					}
				}
				publishConstants();
				for (const asset of assets) {
					if (asset.source) copyAssetToMemory(asset);
					else if (asset.downloadLoading && !pendingDownloads.has(asset.url)) void fetchAssetsForUrl(asset.url);
				}
			}

			store.subscribe('editorConfig.bin', syncConfig);
			store.subscribe('compiler.result.memoryPlan', recopyAssetsToMemory);
			store.set('editorConfigSchemaContributions.binaryAssets', binaryAssetsEditorConfigSchemaContribution);
			syncConfig();

			return () => {
				disposed = true;
				store.unsubscribe('editorConfig.bin', syncConfig);
				store.unsubscribe('compiler.result.memoryPlan', recopyAssetsToMemory);
				for (const asset of assets) finishDownload(asset, 'cancelled');
				for (const controller of pendingDownloads.values()) controller.abort();
				pendingDownloads.clear();
				assets = [];
				const constants = { ...store.getState().envConstantContributions };
				delete constants.binaryAssets;
				store.set('envConstantContributions', constants);
				const schemas = { ...store.getState().editorConfigSchemaContributions };
				delete schemas.binaryAssets;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
