import type { EditorPlugin } from '@8f4e/editor-core';
import { getExportBaseName } from '@8f4e/editor-state';

export function createWasmExportPlugin({
	exportBinaryCode,
}: {
	exportBinaryCode: (fileName: string) => Promise<void>;
}): EditorPlugin {
	return {
		id: 'wasm-export',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const unregisterMenu = menus.registerItem('mainMenu', () => ({
				title: 'Export WebAssembly',
				action: 'exportWasm',
				close: true,
			}));
			const onExport = () =>
				exportBinaryCode(`${getExportBaseName(state)}.wasm`).catch(error => {
					console.error('Failed to export WebAssembly file:', error);
				});
			events.on('exportWasm', onExport);
			return () => {
				events.off('exportWasm', onExport);
				unregisterMenu();
			};
		},
	};
}
