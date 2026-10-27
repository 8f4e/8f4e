import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import createMidiDeviceManager from './devices';

interface MIDIPortMock {
	id?: string;
	manufacturer?: string | null;
	name?: string | null;
	state?: string;
}

interface MIDIAccessMock {
	inputs: Map<string, MIDIPortMock>;
	outputs: Map<string, MIDIPortMock>;
	onstatechange: ((event: unknown) => void) | null;
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
	dispatchStateChange: (event?: unknown) => void;
}

function createMIDIAccessMock({
	inputs = new Map(),
	outputs = new Map(),
	onstatechange = null,
}: Partial<Pick<MIDIAccessMock, 'inputs' | 'outputs' | 'onstatechange'>> = {}): MIDIAccessMock {
	const stateChangeListeners = new Set<(event: unknown) => void>();
	const access: MIDIAccessMock = {
		inputs,
		outputs,
		onstatechange,
		addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
			if (type === 'statechange') {
				stateChangeListeners.add(listener);
			}
		}),
		removeEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
			if (type === 'statechange') {
				stateChangeListeners.delete(listener);
			}
		}),
		dispatchStateChange: (event = {}) => {
			access.onstatechange?.(event);
			for (const listener of stateChangeListeners) {
				listener(event);
			}
		},
	};

	return access;
}

function createStore() {
	return createStateManager(
		createMockState({
			info: {},
		})
	);
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('createMidiDeviceManager', () => {
	it('commits an empty MIDI device list when Web MIDI is unavailable', () => {
		const store = createStore();
		const manager = createMidiDeviceManager({ store, navigator: {} as Navigator });

		expect(store.getState().info.midi).toEqual({});

		manager.dispose();

		expect(store.getState().info.midi).toBeUndefined();
	});

	it('commits available MIDI devices into state.info.midi', async () => {
		const store = createStore();
		const access = createMIDIAccessMock({
			inputs: new Map([
				[
					'input-a',
					{
						id: '-1710537465',
						manufacturer: 'Acme',
						name: 'Keys',
						state: 'connected',
					},
				],
			]),
			outputs: new Map([
				[
					'output-a',
					{
						id: 'output-a',
						manufacturer: 'Acme',
						name: 'Synth',
						state: 'connected',
					},
				],
			]),
		});
		const requestMIDIAccess = vi.fn(async () => access as unknown as MIDIAccess);
		const manager = createMidiDeviceManager({
			store,
			navigator: { requestMIDIAccess } as unknown as Navigator,
		});

		expect(store.getState().info.midi).toEqual({});

		await flushPromises();

		expect(requestMIDIAccess).toHaveBeenCalledTimes(1);
		expect(store.getState().info.midi).toEqual({
			'0': 'Keys (in)',
			'1': 'Synth (out)',
		});
		expect(manager.getInputPort('0')).toBe(access.inputs.get('input-a'));
		expect(manager.getInputPort('-1710537465')).toBeUndefined();
		expect(manager.getInputPort('1')).toBeUndefined();

		access.inputs.set('input-b', {
			id: 'input-b',
			name: 'Pads',
			state: 'connected',
		});
		access.outputs.set('output-b', {
			id: 'output-b',
			name: 'Disconnected output',
			state: 'disconnected',
		});
		access.dispatchStateChange();

		expect(store.getState().info.midi).toEqual({
			'0': 'Keys (in)',
			'1': 'Synth (out)',
			'2': 'Pads (in)',
		});
		expect(manager.getInputPort('2')).toBe(access.inputs.get('input-b'));

		access.inputs.get('input-a')!.state = 'disconnected';
		access.dispatchStateChange();

		expect(store.getState().info.midi).toEqual({
			'1': 'Synth (out)',
			'2': 'Pads (in)',
		});
		expect(manager.getInputPort('0')).toBeUndefined();
		expect(manager.getInputPort('2')).toBe(access.inputs.get('input-b'));

		access.inputs.get('input-a')!.state = 'connected';
		access.dispatchStateChange();

		expect(store.getState().info.midi).toEqual({
			'0': 'Keys (in)',
			'1': 'Synth (out)',
			'2': 'Pads (in)',
		});
		expect(manager.getInputPort('0')).toBe(access.inputs.get('input-a'));

		manager.dispose();

		expect(store.getState().info.midi).toBeUndefined();
	});

	it('leaves an existing MIDI statechange property handler untouched', async () => {
		const store = createStore();
		const previousStateChangeHandler = vi.fn();
		const access = createMIDIAccessMock({
			onstatechange: previousStateChangeHandler,
		});
		const manager = createMidiDeviceManager({
			store,
			navigator: {
				requestMIDIAccess: vi.fn(async () => access as unknown as MIDIAccess),
			} as unknown as Navigator,
		});

		await flushPromises();
		access.dispatchStateChange('state-change');

		expect(previousStateChangeHandler).toHaveBeenCalledWith('state-change');
		expect(access.onstatechange).toBe(previousStateChangeHandler);

		manager.dispose();

		expect(access.onstatechange).toBe(previousStateChangeHandler);
	});

	it('keeps another manager subscribed when managers sharing MIDI access are disposed out of order', async () => {
		const firstStore = createStore();
		const secondStore = createStore();
		const access = createMIDIAccessMock();
		const navigator = {
			requestMIDIAccess: vi.fn(async () => access as unknown as MIDIAccess),
		} as unknown as Navigator;
		const first = createMidiDeviceManager({ store: firstStore, navigator });
		const second = createMidiDeviceManager({ store: secondStore, navigator });

		await flushPromises();
		access.inputs.set('input-a', { id: 'input-a', name: 'Keys', state: 'connected' });
		access.dispatchStateChange();

		expect(firstStore.getState().info.midi).toEqual({ '0': 'Keys (in)' });
		expect(secondStore.getState().info.midi).toEqual({ '0': 'Keys (in)' });

		first.dispose();
		access.inputs.set('input-b', { id: 'input-b', name: 'Pads', state: 'connected' });
		access.dispatchStateChange();

		expect(firstStore.getState().info.midi).toBeUndefined();
		expect(secondStore.getState().info.midi).toEqual({
			'0': 'Keys (in)',
			'1': 'Pads (in)',
		});

		second.dispose();

		expect(access.addEventListener).toHaveBeenCalledTimes(2);
		expect(access.removeEventListener).toHaveBeenCalledTimes(2);
	});
});
