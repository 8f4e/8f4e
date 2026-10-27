import type { EditorPlugin } from '@8f4e/editor-core';
import { midiEditorConfigSchemaContribution } from './config';
import createMidiDeviceManager from './devices';
import createMidiIn from './midiIn';
import { createWasmExports } from './wasmExports';

export function createMidiInputPlugin({
	navigator,
	getMemory,
	getCodeBuffer,
}: {
	navigator: Navigator;
	getMemory: () => WebAssembly.Memory | null;
	getCodeBuffer: () => Uint8Array;
}): EditorPlugin {
	return {
		id: 'midi-input',
		setup: ({ store }) => {
			const getWasmExports = createWasmExports({ getMemory, getCodeBuffer });
			let disposeInput: (() => void) | undefined;

			function syncConfig(): void {
				if (store.getState().editorConfig.midi === undefined) {
					disposeInput?.();
					disposeInput = undefined;
					return;
				}
				if (disposeInput) return;
				let input: ReturnType<typeof createMidiIn> | undefined;
				const devices = createMidiDeviceManager({
					store,
					navigator,
					onPortsChanged: () => {
						if (input) void input.sync();
						else input = createMidiIn({ store, getInputPort: devices.getInputPort, getWasmExports });
					},
				});
				disposeInput = () => {
					input?.dispose();
					devices.dispose();
				};
			}

			store.subscribe('editorConfig.midi', syncConfig);
			store.set('editorConfigSchemaContributions.midi', midiEditorConfigSchemaContribution);
			syncConfig();
			return () => {
				store.unsubscribe('editorConfig.midi', syncConfig);
				disposeInput?.();
				const schemas = { ...store.getState().editorConfigSchemaContributions };
				delete schemas.midi;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
