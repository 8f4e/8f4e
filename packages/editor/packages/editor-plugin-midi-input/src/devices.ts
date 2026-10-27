import type { EditorPluginContext } from '@8f4e/editor-core';
import type { InfoRecord } from '@8f4e/editor-state-types';

interface MidiPortRegistry {
	inputsByIndex: Map<string, MIDIInput>;
	indexesByKey: Map<string, number>;
}

function formatPortName(port: MIDIPort, fallback: string): string {
	const name = port.name?.trim();

	return name || fallback;
}

function getPortIndex(kind: 'input' | 'output', portKey: string, indexesByKey: Map<string, number>): string {
	const indexedPortKey = `${kind}\u0000${portKey}`;
	let index = indexesByKey.get(indexedPortKey);
	if (index === undefined) {
		index = indexesByKey.size;
		indexesByKey.set(indexedPortKey, index);
	}

	return String(index);
}

function addInputPorts(
	info: InfoRecord,
	ports: MIDIInputMap,
	inputsByIndex: Map<string, MIDIInput>,
	indexesByKey: Map<string, number>
): void {
	ports.forEach(port => {
		if (port.state !== 'connected') {
			return;
		}

		const index = getPortIndex('input', port.id, indexesByKey);
		info[index] = formatPortName(port, index) + ' (in)';
		inputsByIndex.set(index, port);
	});
}

function addOutputPorts(info: InfoRecord, ports: MIDIOutputMap, indexesByKey: Map<string, number>): void {
	ports.forEach(port => {
		if (port.state !== 'connected') {
			return;
		}

		const index = getPortIndex('output', port.id, indexesByKey);
		info[index] = formatPortName(port, index) + ' (out)';
	});
}

function createMidiInfo(access: MIDIAccess, portRegistry: MidiPortRegistry): InfoRecord {
	portRegistry.inputsByIndex.clear();

	const info: InfoRecord = {};
	addInputPorts(info, access.inputs, portRegistry.inputsByIndex, portRegistry.indexesByKey);
	addOutputPorts(info, access.outputs, portRegistry.indexesByKey);
	return info;
}

export default function createMidiDeviceManager({
	store,
	navigator,
	onPortsChanged,
}: {
	store: EditorPluginContext['store'];
	navigator: Navigator;
	onPortsChanged?: () => void;
}) {
	const requestMIDIAccess = navigator.requestMIDIAccess;
	const portRegistry: MidiPortRegistry = {
		inputsByIndex: new Map(),
		indexesByKey: new Map(),
	};
	let disposed = false;
	let midiAccess: MIDIAccess | undefined;

	function setMidiInfo(info: InfoRecord | undefined): void {
		store.set('info.midi', info);
	}

	function updateMidiInfo(): void {
		if (!midiAccess || disposed) {
			return;
		}

		setMidiInfo(createMidiInfo(midiAccess, portRegistry));
		onPortsChanged?.();
	}

	function onStateChange(): void {
		updateMidiInfo();
	}

	if (typeof requestMIDIAccess !== 'function') {
		setMidiInfo({});
		return {
			getInputPort: () => undefined,
			dispose: () => {
				disposed = true;
				setMidiInfo(undefined);
			},
		};
	}

	setMidiInfo({});

	void requestMIDIAccess
		.call(navigator)
		.then(access => {
			if (disposed) {
				return;
			}

			midiAccess = access;
			access.addEventListener('statechange', onStateChange);
			updateMidiInfo();
		})
		.catch(() => {
			if (!disposed) {
				setMidiInfo({});
				onPortsChanged?.();
			}
		});

	return {
		getInputPort: (port: string) => portRegistry.inputsByIndex.get(port),
		dispose: () => {
			disposed = true;
			midiAccess?.removeEventListener('statechange', onStateChange);
			portRegistry.inputsByIndex.clear();
			portRegistry.indexesByKey.clear();
			setMidiInfo(undefined);
		},
	};
}
