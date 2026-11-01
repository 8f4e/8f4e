import type { EditorPlugin } from '@8f4e/editor-core';
import { getExportBaseName, logError } from '@8f4e/editor-state';

export function createWasmExportPlugin({
	document,
	getCodeBuffer,
}: {
	document: Document;
	getCodeBuffer: () => Uint8Array;
}): EditorPlugin {
	const browserWindow = document.defaultView as Window &
		typeof globalThis & {
			showSaveFilePicker?: (options: {
				suggestedName: string;
				types: Array<{ description: string; accept: Record<string, string[]> }>;
			}) => Promise<FileSystemFileHandle>;
		};
	return {
		id: 'wasm-export',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const unregisterMenu = menus.registerItem('mainMenu', () => ({
				title: 'Export WebAssembly',
				action: 'exportWasm',
				close: true,
			}));
			const onExport = async () => {
				const fileName = `${getExportBaseName(state)}.wasm`;
				const blob = new Blob([new Uint8Array(getCodeBuffer())], { type: 'application/wasm' });
				try {
					if (browserWindow.showSaveFilePicker) {
						const handle = await browserWindow.showSaveFilePicker({
							suggestedName: fileName,
							types: [{ description: 'WebAssembly Binary', accept: { 'application/wasm': ['.wasm'] } }],
						});
						const writable = await handle.createWritable();
						try {
							await writable.write(blob);
							await writable.close();
						} catch (error) {
							await writable.abort().catch(() => undefined);
							throw error;
						}
					} else {
						const url = browserWindow.URL.createObjectURL(blob);
						const link = document.createElement('a');
						link.href = url;
						link.download = fileName;
						link.style.display = 'none';
						document.body.appendChild(link);
						try {
							link.click();
						} finally {
							link.remove();
							browserWindow.URL.revokeObjectURL(url);
						}
					}
				} catch (error) {
					if (error instanceof Error && error.name === 'AbortError') return;
					logError(state, `Failed to export WebAssembly: ${String(error)}`);
				}
			};
			events.on('exportWasm', onExport);
			return () => {
				events.off('exportWasm', onExport);
				unregisterMenu();
			};
		},
	};
}
