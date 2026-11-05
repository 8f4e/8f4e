import type { EditorPlugin } from '@8f4e/editor-core';
import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import { binaryAssetsEditorConfigSchemaContribution, resolveBinaryAssetLoadRequests } from './config';
import fetchBinaryAsset from './fetchBinaryAsset';

type BinaryAssetSource = Awaited<ReturnType<typeof fetchBinaryAsset>>;

type BinaryAsset = {
	id: string;
	url: string;
	source?: BinaryAssetSource;
	destinations: Array<{ memoryId: string; copiedToMemory: boolean }>;
	finishDownload?: () => void;
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
			let generation = 0;
			let disposed = false;
			let signature = '';

			function finishDownload(asset: BinaryAsset) {
				const finish = asset.finishDownload;
				asset.finishDownload = undefined;
				finish?.();
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

			async function fetchAssetsForUrl(url: string, matchingAssets: BinaryAsset[], currentGeneration: number) {
				let source: BinaryAssetSource;
				try {
					source = await fetchBinaryAsset(url);
				} catch (error) {
					if (disposed || currentGeneration !== generation) return;
					console.error('Failed to fetch binary asset:', url, error);
					for (const asset of matchingAssets) finishDownload(asset);
					return;
				}
				if (disposed || currentGeneration !== generation) return;
				for (const asset of matchingAssets) {
					asset.source = source;
					finishDownload(asset);
				}
				publishConstants();
				if (disposed || currentGeneration !== generation) return;
				for (const asset of matchingAssets) copyAssetToMemory(asset);
			}

			function syncConfig() {
				const requests = resolveBinaryAssetLoadRequests(store.getState().editorConfig.bin);
				const nextSignature = JSON.stringify(requests);
				if (nextSignature === signature) return;
				signature = nextSignature;
				const currentGeneration = ++generation;
				for (const asset of assets) finishDownload(asset);
				assets = requests.map(request => ({
					id: request.id,
					url: request.url,
					destinations: request.memoryIds.map(memoryId => ({ memoryId, copiedToMemory: false })),
					finishDownload: loading.add({ name: request.id }),
				}));
				publishConstants();
				const assetsByUrl = new Map<string, BinaryAsset[]>();
				for (const asset of assets) {
					const matchingAssets = assetsByUrl.get(asset.url) ?? [];
					matchingAssets.push(asset);
					assetsByUrl.set(asset.url, matchingAssets);
				}
				for (const [url, matchingAssets] of assetsByUrl) {
					void fetchAssetsForUrl(url, matchingAssets, currentGeneration);
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
				for (const asset of assets) finishDownload(asset);
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
