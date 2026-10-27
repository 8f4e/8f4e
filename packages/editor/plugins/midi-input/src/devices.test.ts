import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMidiAccess, createMidiInput, createMidiOutput } from './__tests__/midi';
import createMidiDeviceManager from './devices';

afterEach(() => vi.restoreAllMocks());

function createStore() {
	return createStateManager(createMockState({ info: {} }));
}

describe('createMidiDeviceManager', () => {
	it('commits an empty MIDI device list when Web MIDI is unavailable', () => {
		const store = createStore();
		const manager = createMidiDeviceManager({ store, navigator: {} as Navigator, onPortsChanged: vi.fn() });
		expect(store.getState().info.midi).toEqual({});
		manager.dispose();
		expect(store.getState().info.midi).toBeUndefined();
	});

	it('publishes devices and preserves their indexes across disconnects and reconnects', async () => {
		const store = createStore();
		const midi = createMidiAccess();
		const keys = createMidiInput('-1710537465', 'Keys');
		midi.inputs.set(keys.input.id, keys.input);
		midi.outputs.set('output-a', createMidiOutput('output-a', 'Synth'));
		const requestMIDIAccess = vi.fn(async () => midi.access);
		const onPortsChanged = vi.fn();
		const manager = createMidiDeviceManager({
			store,
			navigator: { requestMIDIAccess } as unknown as Navigator,
			onPortsChanged,
		});
		expect(store.getState().info.midi).toEqual({});
		await vi.waitFor(() => expect(onPortsChanged).toHaveBeenCalledOnce());
		expect(requestMIDIAccess).toHaveBeenCalledOnce();
		expect(store.getState().info.midi).toEqual({ '0': 'Keys (in)', '1': 'Synth (out)' });
		expect(manager.getInputPort('0')).toBe(keys.input);
		expect(manager.getInputPort(keys.input.id)).toBeUndefined();
		expect(manager.getInputPort('1')).toBeUndefined();

		const pads = createMidiInput('input-b', 'Pads');
		midi.inputs.set(pads.input.id, pads.input);
		midi.outputs.set('output-b', createMidiOutput('output-b', 'Disconnected output', 'disconnected'));
		midi.change();
		expect(store.getState().info.midi).toEqual({ '0': 'Keys (in)', '1': 'Synth (out)', '2': 'Pads (in)' });
		expect(manager.getInputPort('2')).toBe(pads.input);

		keys.setState('disconnected');
		midi.change();
		expect(store.getState().info.midi).toEqual({ '1': 'Synth (out)', '2': 'Pads (in)' });
		expect(manager.getInputPort('0')).toBeUndefined();
		expect(manager.getInputPort('2')).toBe(pads.input);

		keys.setState('connected');
		midi.change();
		expect(store.getState().info.midi).toEqual({ '0': 'Keys (in)', '1': 'Synth (out)', '2': 'Pads (in)' });
		expect(manager.getInputPort('0')).toBe(keys.input);
		manager.dispose();
		expect(store.getState().info.midi).toBeUndefined();
	});

	it('leaves an existing MIDI statechange property handler untouched', async () => {
		const store = createStore();
		const midi = createMidiAccess();
		const previousHandler = vi.fn();
		midi.access.onstatechange = previousHandler;
		const onPortsChanged = vi.fn();
		const manager = createMidiDeviceManager({
			store,
			navigator: { requestMIDIAccess: async () => midi.access } as Navigator,
			onPortsChanged,
		});
		await vi.waitFor(() => expect(onPortsChanged).toHaveBeenCalledOnce());
		const event = midi.change();
		expect(previousHandler).toHaveBeenCalledWith(event);
		expect(midi.access.onstatechange).toBe(previousHandler);
		manager.dispose();
		expect(midi.access.onstatechange).toBe(previousHandler);
	});

	it('keeps another manager subscribed when shared MIDI access is disposed out of order', async () => {
		const firstStore = createStore();
		const secondStore = createStore();
		const midi = createMidiAccess();
		const add = vi.spyOn(midi.access, 'addEventListener');
		const remove = vi.spyOn(midi.access, 'removeEventListener');
		const navigator = { requestMIDIAccess: async () => midi.access } as Navigator;
		const firstChanged = vi.fn();
		const secondChanged = vi.fn();
		const first = createMidiDeviceManager({ store: firstStore, navigator, onPortsChanged: firstChanged });
		const second = createMidiDeviceManager({ store: secondStore, navigator, onPortsChanged: secondChanged });
		await vi.waitFor(() => {
			expect(firstChanged).toHaveBeenCalledOnce();
			expect(secondChanged).toHaveBeenCalledOnce();
		});
		const keys = createMidiInput('input-a', 'Keys');
		midi.inputs.set(keys.input.id, keys.input);
		midi.change();
		expect(firstStore.getState().info.midi).toEqual({ '0': 'Keys (in)' });
		expect(secondStore.getState().info.midi).toEqual({ '0': 'Keys (in)' });

		first.dispose();
		const pads = createMidiInput('input-b', 'Pads');
		midi.inputs.set(pads.input.id, pads.input);
		midi.change();
		expect(firstStore.getState().info.midi).toBeUndefined();
		expect(secondStore.getState().info.midi).toEqual({ '0': 'Keys (in)', '1': 'Pads (in)' });
		second.dispose();
		expect(add).toHaveBeenCalledTimes(2);
		expect(remove).toHaveBeenCalledTimes(2);
	});
});
