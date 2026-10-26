import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { midiEditorConfigSchemaContribution, resolveMidiInputBindings } from './config';

describe('MIDI editor config', () => {
	it('contributes a dynamic inputs schema', () => {
		expect(midiEditorConfigSchemaContribution).toMatchObject({
			root: 'midi',
			schema: {
				type: 'object',
				properties: {
					inputs: {
						type: 'object',
					},
				},
			},
		});
	});

	it('resolves input bindings from editor config', () => {
		const state = createMockState({
			editorConfig: {
				midi: {
					inputs: {
						0: { port: 0, callback: 'onMidiIn' },
						1: { port: 1, callback: 'onPitchBend' },
					},
				},
			},
		});

		expect(resolveMidiInputBindings(state)).toEqual([
			{ port: '0', exportName: 'onMidiIn' },
			{ port: '1', exportName: 'onPitchBend' },
		]);
	});

	it('logs and skips incomplete or duplicate input bindings', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const state = createMockState({
			editorConfig: {
				midi: {
					inputs: {
						0: { port: 0, callback: 'onMidiIn' },
						1: { port: 0, callback: 'onMidiIn' },
						2: { port: 1 },
					},
				},
			},
		});

		expect(resolveMidiInputBindings(state)).toEqual([{ port: '0', exportName: 'onMidiIn' }]);
		expect(consoleError).toHaveBeenCalledWith('Duplicate MIDI input binding for port "0" and callback "onMidiIn".');
		expect(consoleError).toHaveBeenCalledWith(
			'MIDI input config "2" must define a numeric port and callback export name.'
		);

		consoleError.mockRestore();
	});
});
