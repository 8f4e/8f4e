import type { EditorPluginContext } from '@8f4e/editor-core';
import { resolveMidiInputBindings } from './config';

export default function createMidiIn({
	store,
	getInputPort,
	getWasmExports,
}: {
	store: EditorPluginContext['store'];
	getInputPort: (port: string) => MIDIInput | undefined;
	getWasmExports: () => Promise<WebAssembly.Exports | undefined>;
}) {
	const listeners: Array<{ input: MIDIInput; handler: (event: MIDIMessageEvent) => void }> = [];
	let generation = 0;

	function removeListeners(): void {
		for (const { input, handler } of listeners) input.removeEventListener('midimessage', handler);
		listeners.length = 0;
	}

	async function sync(): Promise<void> {
		const currentGeneration = ++generation;
		removeListeners();
		const state = store.getState();
		if (state.compiler.isCompiling) return;

		const bindings = resolveMidiInputBindings(state);
		const inputs = new Map<string, MIDIInput | undefined>();
		for (const { port } of bindings) {
			if (inputs.has(port)) continue;
			const input = getInputPort(port);
			inputs.set(port, input);
			if (!input) console.error(`MIDI input port "${port}" is not available.`);
		}
		if (![...inputs.values()].some(input => input !== undefined)) return;

		try {
			const exports = await getWasmExports();
			if (generation !== currentGeneration || !exports) return;
			const callbacks = new Map<MIDIInput, Array<{ name: string; call: (...args: number[]) => unknown }>>();
			for (const { port, exportName } of bindings) {
				const input = inputs.get(port);
				if (!input) continue;
				const callback = exports[exportName];
				if (typeof callback !== 'function') {
					console.error(`Missing callable WebAssembly export for MIDI input callback "${exportName}".`);
					continue;
				}
				const group = callbacks.get(input) ?? [];
				group.push({ name: exportName, call: callback as (...args: number[]) => unknown });
				callbacks.set(input, group);
			}
			for (const [input, group] of callbacks) {
				const handler = ({ data }: MIDIMessageEvent) => {
					// Realtime MIDI messages can contain only a status byte.
					const [status = 0, data1 = 0, data2 = 0] = data ?? [];
					for (const callback of group) {
						try {
							callback.call(status, data1, data2);
						} catch (error) {
							console.error(`MIDI input callback "${callback.name}" failed.`, error);
						}
					}
				};
				input.addEventListener('midimessage', handler);
				listeners.push({ input, handler });
			}
		} catch (error) {
			if (generation === currentGeneration)
				console.error('Failed to instantiate MIDI input WebAssembly module:', error);
		}
	}

	store.subscribe('editorConfig.midi', sync);
	store.subscribe('compiler.isCompiling', sync);
	void sync();
	return {
		sync,
		dispose: () => {
			generation++;
			removeListeners();
			store.unsubscribe('editorConfig.midi', sync);
			store.unsubscribe('compiler.isCompiling', sync);
		},
	};
}
