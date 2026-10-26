import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import type { EditorEnvironmentPluginContext } from '../types';
import createMidiIn from './midiIn';
import type { MidiInBinding } from './types';

interface MIDIInputMock {
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
	dispatchMidiMessage: (data: number[]) => void;
}

function createStore(bindings: MidiInBinding[]) {
	return createStateManager(
		createMockState({
			codeBlockRendering: {
				codeBlocks: [],
			},
			compiler: {
				isCompiling: false,
			},
			editorConfig: {
				midi: {
					inputs: Object.fromEntries(
						bindings.map((binding, index) => [
							String(index),
							{
								port: Number(binding.port),
								callback: binding.exportName,
							},
						])
					),
				},
			},
		})
	);
}

function createMIDIInputMock(): MIDIInputMock {
	const listeners = new Set<(event: unknown) => void>();

	return {
		addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
			if (type === 'midimessage') {
				listeners.add(listener);
			}
		}),
		removeEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
			if (type === 'midimessage') {
				listeners.delete(listener);
			}
		}),
		dispatchMidiMessage: (data: number[]) => {
			for (const listener of listeners) {
				listener({ data });
			}
		},
	};
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

function createGetWasmExports(
	exports: Record<string, (...args: number[]) => unknown>
): EditorEnvironmentPluginContext['services']['getWasmExports'] {
	return vi.fn(async () => ({
		getExports: vi.fn(async () => exports as WebAssembly.Exports),
		invalidate: vi.fn(),
	}));
}

describe('createMidiIn', () => {
	it('fans one MIDI input event out to every callback bound to the port', async () => {
		const onNote = vi.fn();
		const onPitchBend = vi.fn();
		const input = createMIDIInputMock();
		const setErrors = vi.fn();
		const getInputPort = vi.fn(port => (port === '0' ? (input as unknown as MIDIInput) : undefined));
		const store = createStore([
			{ port: '0', exportName: 'onNote' },
			{ port: '0', exportName: 'onPitchBend' },
		]);

		const manager = createMidiIn({
			store,
			setErrors,
			getInputPort,
			getWasmExports: createGetWasmExports({
				onNote,
				onPitchBend,
			}),
		});

		await flushPromises();
		input.dispatchMidiMessage([0x90, 64, 127]);

		expect(onNote).toHaveBeenCalledWith(0x90, 64, 127);
		expect(onPitchBend).toHaveBeenCalledWith(0x90, 64, 127);
		expect(setErrors).toHaveBeenLastCalledWith([]);
		expect(getInputPort).toHaveBeenCalledTimes(1);

		manager.dispose();
	});

	it('defaults missing MIDI data bytes to zero', async () => {
		const onClock = vi.fn();
		const input = createMIDIInputMock();
		const store = createStore([{ port: '0', exportName: 'onClock' }]);

		const manager = createMidiIn({
			store,
			setErrors: vi.fn(),
			getInputPort: () => input as unknown as MIDIInput,
			getWasmExports: createGetWasmExports({
				onClock,
			}),
		});

		await flushPromises();
		input.dispatchMidiMessage([0xf8]);

		expect(onClock).toHaveBeenCalledWith(0xf8, 0, 0);

		manager.dispose();
	});

	it('logs missing ports and missing callback exports without attaching listeners', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const setErrors = vi.fn();
		const input = createMIDIInputMock();
		const store = createStore([
			{ port: '0', exportName: 'missingExport' },
			{ port: '1', exportName: 'onMidiIn' },
		]);

		const manager = createMidiIn({
			store,
			setErrors,
			getInputPort: port => (port === '0' ? (input as unknown as MIDIInput) : undefined),
			getWasmExports: createGetWasmExports({
				onMidiIn: vi.fn(),
			}),
		});

		await flushPromises();

		expect(input.addEventListener).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith('MIDI input port "1" is not available.');
		expect(consoleError).toHaveBeenCalledWith(
			'Missing callable WebAssembly export for MIDI input callback "missingExport".'
		);
		expect(setErrors).toHaveBeenLastCalledWith([]);

		manager.dispose();
		consoleError.mockRestore();
	});

	it('logs missing ports without waiting for WebAssembly exports', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const setErrors = vi.fn();
		const getWasmExports = vi.fn();
		const store = createStore([{ port: '1', exportName: 'onMidiIn' }]);

		const manager = createMidiIn({
			store,
			setErrors,
			getInputPort: () => undefined,
			getWasmExports,
		});

		expect(consoleError).toHaveBeenCalledWith('MIDI input port "1" is not available.');
		expect(setErrors).toHaveBeenLastCalledWith([]);
		expect(getWasmExports).not.toHaveBeenCalled();

		manager.dispose();
		consoleError.mockRestore();
	});

	it('continues calling later callbacks when one callback throws', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = vi.fn(() => {
			throw new Error('nope');
		});
		const later = vi.fn();
		const setErrors = vi.fn();
		const input = createMIDIInputMock();
		const store = createStore([
			{ port: '0', exportName: 'broken' },
			{ port: '0', exportName: 'later' },
		]);

		const manager = createMidiIn({
			store,
			setErrors,
			getInputPort: () => input as unknown as MIDIInput,
			getWasmExports: createGetWasmExports({
				broken,
				later,
			}),
		});

		await flushPromises();
		input.dispatchMidiMessage([0xb0, 1, 2]);

		expect(broken).toHaveBeenCalledWith(0xb0, 1, 2);
		expect(later).toHaveBeenCalledWith(0xb0, 1, 2);
		expect(consoleError).toHaveBeenCalledWith('MIDI input callback "broken" failed.', expect.any(Error));
		expect(setErrors).toHaveBeenLastCalledWith([]);

		manager.dispose();
		consoleError.mockRestore();
	});
});
