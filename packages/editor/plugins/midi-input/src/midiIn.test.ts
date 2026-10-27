import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMidiInput } from './__tests__/midi';
import createMidiIn from './midiIn';

afterEach(() => vi.restoreAllMocks());

function createStore(bindings: Array<{ port: string; exportName: string }>) {
	return createStateManager(
		createMockState({
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

describe('createMidiIn', () => {
	it.each(['configuration removal', 'compilation', 'disposal'] as const)(
		'ignores exports that arrive after %s',
		async action => {
			const midi = createMidiInput();
			const add = vi.spyOn(midi.input, 'addEventListener');
			const store = createStore([{ port: '0', exportName: 'onMidi' }]);
			let finish!: (exports: WebAssembly.Exports) => void;
			const exports = new Promise<WebAssembly.Exports>(resolve => {
				finish = resolve;
			});
			const manager = createMidiIn({ store, getInputPort: () => midi.input, getWasmExports: () => exports });
			if (action === 'configuration removal') store.set('editorConfig.midi', undefined);
			else if (action === 'compilation') store.set('compiler.isCompiling', true);
			else manager.dispose();
			finish({ onMidi: vi.fn() });
			await exports;
			expect(add).not.toHaveBeenCalled();
			if (action !== 'disposal') manager.dispose();
			store.dispose();
		}
	);

	it('fans one MIDI event out to every callback bound to the port', async () => {
		const onNote = vi.fn();
		const onPitchBend = vi.fn();
		const midi = createMidiInput();
		const add = vi.spyOn(midi.input, 'addEventListener');
		const getInputPort = vi.fn(port => (port === '0' ? midi.input : undefined));
		const store = createStore([
			{ port: '0', exportName: 'onNote' },
			{ port: '0', exportName: 'onPitchBend' },
		]);
		const manager = createMidiIn({ store, getInputPort, getWasmExports: async () => ({ onNote, onPitchBend }) });
		await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
		midi.send([0x90, 64, 127]);
		expect(onNote).toHaveBeenCalledWith(0x90, 64, 127);
		expect(onPitchBend).toHaveBeenCalledWith(0x90, 64, 127);
		expect(getInputPort).toHaveBeenCalledOnce();
		manager.dispose();
	});

	it('defaults missing MIDI data bytes to zero', async () => {
		const onClock = vi.fn();
		const midi = createMidiInput();
		const add = vi.spyOn(midi.input, 'addEventListener');
		const store = createStore([{ port: '0', exportName: 'onClock' }]);
		const manager = createMidiIn({ store, getInputPort: () => midi.input, getWasmExports: async () => ({ onClock }) });
		await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
		midi.send([0xf8]);
		expect(onClock).toHaveBeenCalledWith(0xf8, 0, 0);
		manager.dispose();
	});

	it('logs missing ports and callback exports without attaching listeners', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const midi = createMidiInput();
		const add = vi.spyOn(midi.input, 'addEventListener');
		const store = createStore([
			{ port: '0', exportName: 'missingExport' },
			{ port: '1', exportName: 'onMidiIn' },
		]);
		const manager = createMidiIn({
			store,
			getInputPort: port => (port === '0' ? midi.input : undefined),
			getWasmExports: async () => ({ onMidiIn: vi.fn() }),
		});
		await vi.waitFor(() =>
			expect(consoleError).toHaveBeenCalledWith(
				'Missing callable WebAssembly export for MIDI input callback "missingExport".'
			)
		);
		expect(add).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith('MIDI input port "1" is not available.');
		manager.dispose();
	});

	it('logs missing ports without waiting for WebAssembly exports', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const getWasmExports = vi.fn();
		const store = createStore([{ port: '1', exportName: 'onMidiIn' }]);
		const manager = createMidiIn({ store, getInputPort: () => undefined, getWasmExports });
		expect(consoleError).toHaveBeenCalledWith('MIDI input port "1" is not available.');
		expect(getWasmExports).not.toHaveBeenCalled();
		manager.dispose();
	});

	it('continues calling later callbacks when one callback throws', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = vi.fn(() => {
			throw new Error('nope');
		});
		const later = vi.fn();
		const midi = createMidiInput();
		const add = vi.spyOn(midi.input, 'addEventListener');
		const store = createStore([
			{ port: '0', exportName: 'broken' },
			{ port: '0', exportName: 'later' },
		]);
		const manager = createMidiIn({
			store,
			getInputPort: () => midi.input,
			getWasmExports: async () => ({ broken, later }),
		});
		await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
		midi.send([0xb0, 1, 2]);
		expect(broken).toHaveBeenCalledWith(0xb0, 1, 2);
		expect(later).toHaveBeenCalledWith(0xb0, 1, 2);
		expect(consoleError).toHaveBeenCalledWith('MIDI input callback "broken" failed.', expect.any(Error));
		manager.dispose();
	});
});
