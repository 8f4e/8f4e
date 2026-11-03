import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { resolveMidiInputBindings } from './config';

describe('MIDI editor config', () => {
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

	it('skips incomplete and duplicate input bindings', () => {
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
	});
});
