import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMidiAccess, createMidiInput } from './__tests__/midi';
import { createMidiInputPlugin } from './index';

const SOURCE = `8f4e/v1
note config
; @config midi.inputs.keys.port 0
; @config midi.inputs.keys.callback onMidi
noteEnd
entry main
module received
int status
int note
int velocity
moduleEnd
entryEnd
function onMidi
#export onMidi
#impure
param int status
param int note
param int velocity
push &received:status
push status
store
push &received:note
push note
store
push &received:velocity
push velocity
store
functionEnd`;

function createMidiFixture() {
	const midi = createMidiAccess();
	const keys = createMidiInput();
	midi.inputs.set(keys.input.id, keys.input);
	return { ...midi, ...keys };
}

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

async function setup({ requestMIDIAccess = vi.fn(async () => createMidiFixture().access), source = SOURCE } = {}) {
	const project = parseProjectSource(source);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	let memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
	const events = createMockEventDispatcher();
	const store = initState(events, { runtimeRegistry: {}, callbacks: { loadSession: async () => null } });
	let newCode = new Uint8Array(compiled.codeBuffer);
	const dispose = createMidiInputPlugin({
		navigator: { requestMIDIAccess } as unknown as Navigator,
		getMemory: () => memory,
		getCodeBuffer: () => newCode,
	}).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		drawers: createCodeBlockDrawerRegistry(),
	});
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	store.set('initialProjectState', project);
	return {
		store,
		dispose,
		requestMIDIAccess,
		read: () => {
			const view = new Int32Array(memory.buffer);
			return Object.values(compiled.memoryPlan.modules.received.memory).map(
				declaration => view[declaration.allocationUnitAddress]
			);
		},
		replaceMemory: () => {
			memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
			newCode = new Uint8Array(compiled.codeBuffer);
		},
	};
}

describe('MIDI input plugin', () => {
	it('requests access only when configured, invokes real compiled callbacks, and rebinds after compilation', async () => {
		const midi = createMidiFixture();
		const add = vi.spyOn(midi.input, 'addEventListener');
		const requestMIDIAccess = vi.fn(async () => midi.access);
		const editor = await setup({ requestMIDIAccess });
		await vi.waitFor(() => expect(add).toHaveBeenCalledWith('midimessage', expect.any(Function)));
		expect(requestMIDIAccess).toHaveBeenCalledOnce();
		expect(editor.store.getState().info.midi).toEqual({ '0': 'Keys (in)' });
		midi.send([0x90, 64, 127]);
		expect(editor.read()).toEqual([0x90, 64, 127]);
		editor.store.set('compiler.isCompiling', true);
		midi.send([0x90, 65, 100]);
		expect(editor.read()).toEqual([0x90, 64, 127]);
		editor.replaceMemory();
		editor.store.set('compiler.isCompiling', false);
		await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(2));
		midi.send([0x80, 64, 0]);
		expect(editor.read()).toEqual([0x80, 64, 0]);
		editor.store.set('editorConfig.midi', undefined);
		midi.send([0x90, 72, 90]);
		expect(editor.read()).toEqual([0x80, 64, 0]);
		expect(editor.store.getState().info.midi).toBeUndefined();
	});

	it('does not request access for projects without MIDI config', async () => {
		const editor = await setup({ source: SOURCE.replace(/^; @config midi.*\n/gm, '') });
		expect(editor.requestMIDIAccess).not.toHaveBeenCalled();
		expect(editor.store.getState().info.midi).toBeUndefined();
	});

	it('does not attach to MIDI access that arrives after config removal or disposal', async () => {
		const midi = createMidiFixture();
		const add = vi.spyOn(midi.access, 'addEventListener');
		let finish!: (access: MIDIAccess) => void;
		const access = new Promise<MIDIAccess>(resolve => {
			finish = resolve;
		});
		const requestMIDIAccess = vi.fn(() => access);
		const editor = await setup({ requestMIDIAccess });
		editor.store.set('editorConfig.midi', undefined);
		editor.dispose();
		finish(midi.access);
		await access;
		expect(add).not.toHaveBeenCalled();
		expect(editor.store.getState().info.midi).toBeUndefined();
		expect(editor.store.getState().editorConfigSchemaContributions.midi).toBeUndefined();
	});

	it('validates config through its owned schema', async () => {
		const editor = await setup({ source: SOURCE.replace('midi.inputs.keys.port 0', 'midi.inputs.keys.port -1') });
		expect(
			editor.store
				.getState()
				.codeErrors.editorDirectiveErrors.some(error => error.message.includes('midi.inputs.keys.port'))
		).toBe(true);
	});
});
