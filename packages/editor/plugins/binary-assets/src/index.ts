import type { EditorPlugin } from '@8f4e/editor-core';
import { addLoadingIndicator } from '@8f4e/editor-state';
import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import { binaryAssetsEditorConfigSchemaContribution, resolveBinaryAssetLoadRequests } from './config';
import fetchBinaryAsset from './fetchBinaryAsset';

type BinaryAsset = {
	id: string;
	url: string;
	memoryId: string;
	data: ArrayBuffer;
	fileName: string;
	loaded: boolean;
};

export function createBinaryAssetsPlugin({
	getMemoryBytes,
}: {
	getMemoryBytes: () => Uint8Array | undefined;
}): EditorPlugin {
	return {
		id: 'binary-assets',
		setup: ({ store }) => {
			let assets: BinaryAsset[] = [];
			let generation = 0;
			let disposed = false;
			let fetching = false;
			const loading = new Map<string, () => void>();
			let signature = '';

			function finishLoading(id: string) {
				loading.get(id)?.();
				loading.delete(id);
			}

			function clearLoadingIndicators() {
				for (const id of loading.keys()) finishLoading(id);
			}

			function startLoading(id: string) {
				if (!loading.has(id)) loading.set(id, addLoadingIndicator(store, { name: id }));
			}

			function syncLoadingIndicators() {
				if (fetching) return;
				const pending = new Set(assets.filter(asset => !asset.loaded).map(asset => asset.id));
				for (const id of loading.keys()) {
					if (!pending.has(id)) finishLoading(id);
				}
				for (const id of pending) startLoading(id);
			}

			function loadIntoMemory() {
				const bytes = getMemoryBytes();
				if (bytes) {
					for (const asset of assets) {
						if (asset.loaded) continue;
						const memory = resolveMemoryTarget(
							store.getState(),
							{ kind: 'project', groupPath: '' },
							asset.memoryId
						)?.memory;
						if (!memory) continue;
						const length = Math.min(asset.data.byteLength, memory.allocatedByteLength);
						if (memory.byteAddress + length > bytes.byteLength) continue;
						bytes.set(new Uint8Array(asset.data, 0, length), memory.byteAddress);
						asset.loaded = true;
					}
				}
				syncLoadingIndicators();
			}

			function reloadMemory() {
				for (const asset of assets) asset.loaded = false;
				loadIntoMemory();
			}

			function publishConstants() {
				const lines: string[] = [];
				const names = new Set<string>();
				for (const asset of assets) {
					const name = `ASSET_${asset.id.toUpperCase()}_SIZE`;
					if (names.has(name)) continue;
					names.add(name);
					lines.push(`; '${asset.fileName}'`, `const ${name} ${asset.data.byteLength}`);
				}
				store.set(
					'envConstantContributions.binaryAssets',
					lines.length ? ['; Binary asset sizes in bytes', ...lines] : []
				);
			}

			async function syncConfig() {
				const requests = resolveBinaryAssetLoadRequests(store.getState().editorConfig.bin);
				const nextSignature = JSON.stringify(requests);
				if (nextSignature === signature) return;
				signature = nextSignature;
				const currentGeneration = ++generation;
				assets = [];
				fetching = requests.length > 0;
				clearLoadingIndicators();
				for (const request of requests) startLoading(request.id);
				publishConstants();

				const fetched = new Map<string, Awaited<ReturnType<typeof fetchBinaryAsset>>>();
				for (const url of new Set(requests.map(request => request.url))) {
					try {
						const asset = await fetchBinaryAsset(url);
						if (disposed || currentGeneration !== generation) return;
						fetched.set(url, asset);
					} catch (error) {
						if (disposed || currentGeneration !== generation) return;
						console.error('Failed to fetch binary asset:', url, error);
						for (const request of requests) {
							if (request.url === url) finishLoading(request.id);
						}
					}
				}
				if (disposed || currentGeneration !== generation) return;
				assets = requests.flatMap(request => {
					const asset = fetched.get(request.url);
					return asset ? [{ ...request, ...asset, loaded: false }] : [];
				});
				fetching = false;
				publishConstants();
				loadIntoMemory();
			}

			store.subscribe('editorConfig.bin', syncConfig);
			store.subscribe('compiler.result.memoryPlan', reloadMemory);
			store.set('editorConfigSchemaContributions.binaryAssets', binaryAssetsEditorConfigSchemaContribution);
			void syncConfig();

			return () => {
				disposed = true;
				store.unsubscribe('editorConfig.bin', syncConfig);
				store.unsubscribe('compiler.result.memoryPlan', reloadMemory);
				assets = [];
				clearLoadingIndicators();
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
