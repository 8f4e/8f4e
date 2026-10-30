import { getEditorBlockId } from '@8f4e/editor-core';
import { mountMinimalEditor } from '@8f4e/editor-minimal';
import { afterEach, expect, test, vi } from 'vitest';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

async function setup(source: string, assets: Record<string, () => Promise<Response>> = {}) {
	const projectUrl = '/lazy-plugins-project.8f4e';
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
		if (input === projectUrl) return Promise.resolve(new Response(source));
		const asset = assets[String(input)];
		return asset ? asset() : fetch(input, options);
	});
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.width = '768px';
	canvas.style.height = '512px';
	document.body.append(canvas);
	cleanups.push(() => canvas.remove());
	const editor = await mountMinimalEditor(canvas, { initialProjectUrl: projectUrl });
	cleanups.push(() => editor.dispose());
	await vi.waitFor(() => expect(editor.state.viewport.width).toBe(768));
	return { canvas, editor };
}

test('recompiles with asset size constants after a lazy asset fetch completes', async () => {
	const assetUrl = 'https://example.com/lazy-sized.pcm';
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const fetchAsset = vi.fn(() => pending);
	const { editor } = await setup(
		`8f4e/v1
note settings
; @config recompileDebounceDelay 10
; @config bin.sound.url ${assetUrl}
; @config bin.sound.memory player:buffer
noteEnd
entry main
module player
use env
int8[] buffer ASSET_SOUND_SIZE
moduleEnd
entryEnd`,
		{ [assetUrl]: fetchAsset }
	);
	await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalledOnce());
	await vi.waitFor(() => expect(editor.state.codeErrors.compilationErrors.length).toBeGreaterThan(0), {
		timeout: 10000,
	});
	expect(editor.state.dialogStack.some(dialog => dialog.id === 'binary-assets-loading')).toBe(true);
	finish(new Response(new Uint8Array([1, 2, 3, 4, 5, 6])));
	await vi.waitFor(
		() => expect(editor.state.compiler.memoryPlan.modules.player?.memory.buffer.numberOfElements).toBe(6),
		{ timeout: 10000 }
	);
	await vi.waitFor(() => expect(editor.getCompilerDiagnostics()?.status).toBe('ready'));
	const memory = editor.state.compiler.memoryPlan.modules.player.memory.buffer;
	expect([...editor.getMemoryViews().uint8.slice(memory.byteAddress, memory.byteAddress + 6)]).toEqual([
		1, 2, 3, 4, 5, 6,
	]);
	expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(editor.state.codeErrors.compilationErrors).toEqual([]);
	expect(editor.state.dialogStack).toEqual([]);
});

test('automatically activates assets added after compilation and reloads them into grown memory', async () => {
	const assetUrl = 'https://example.com/lazy-existing-memory.pcm';
	const fetchAsset = vi.fn(async () => new Response(new Uint8Array([9, 8, 7, 6])));
	const { editor } = await setup(
		`8f4e/v1
note settings ; @mode edit
; @config recompileDebounceDelay 10
noteEnd
entry main
module player
int[] buffer 4
moduleEnd
entryEnd`,
		{ [assetUrl]: fetchAsset }
	);
	await vi.waitFor(() => expect(editor.state.compiler.memoryPlan.modules.player).toBeDefined(), { timeout: 10000 });
	await vi.waitFor(() => expect(editor.getCompilerDiagnostics()?.status).toBe('ready'));
	expect(fetchAsset).not.toHaveBeenCalled();
	expect(editor.state.editorConfigSchemaContributions.binaryAssets).toBeUndefined();
	const config = editor.state.codeBlockRendering.codeBlocks.find(block => block.blockType === 'note')!;
	editor.editing.applyEdits({
		expectedRevision: editor.editing.getRevision(),
		edits: [
			{
				type: 'update',
				blockId: getEditorBlockId(config),
				code: [
					...config.code.slice(0, -1),
					`; @config bin.sound.url ${assetUrl}`,
					'; @config bin.sound.memory player:buffer',
					'noteEnd',
				],
			},
		],
	});
	const read = () => {
		const memory = editor.state.compiler.memoryPlan.modules.player.memory.buffer;
		return [...editor.getMemoryViews().uint8.slice(memory.byteAddress, memory.byteAddress + 4)];
	};
	await vi.waitFor(() => expect(read()).toEqual([9, 8, 7, 6]));
	const buffer = editor.getMemoryViews().uint8.buffer;
	editor.editing.applyEdits({
		expectedRevision: editor.editing.getRevision(),
		edits: [{ type: 'insert', code: ['module larger', 'int[] padding 40000', 'moduleEnd'], entry: 'main' }],
	});
	await vi.waitFor(() => expect(editor.getMemoryViews().uint8.buffer).not.toBe(buffer), { timeout: 10000 });
	await vi.waitFor(() => expect(read()).toEqual([9, 8, 7, 6]));
	expect(fetchAsset).toHaveBeenCalledOnce();
});

test('automatically activates MIDI added after compilation and releases its input listener', async () => {
	const input = Object.assign(new EventTarget(), { id: 'keys', name: 'Keys', state: 'connected' });
	const access = Object.assign(new EventTarget(), {
		inputs: new Map([['keys', input]]),
		outputs: new Map(),
	}) as unknown as MIDIAccess;
	const requestAccess = vi.spyOn(navigator, 'requestMIDIAccess').mockResolvedValue(access);
	const { editor } = await setup(`8f4e/v1
note settings ; @mode edit
; @config recompileDebounceDelay 10
noteEnd
entry main
module received
int status
moduleEnd
entryEnd
function onMidi
#export onMidi
#impure
param int status
push &received:status
push status
store
functionEnd`);
	await vi.waitFor(() => expect(editor.state.compiler.memoryPlan.modules.received).toBeDefined(), { timeout: 10000 });
	expect(requestAccess).not.toHaveBeenCalled();
	expect(editor.state.editorConfigSchemaContributions.midi).toBeUndefined();
	const config = editor.state.codeBlockRendering.codeBlocks.find(block => block.blockType === 'note')!;
	editor.editing.applyEdits({
		expectedRevision: editor.editing.getRevision(),
		edits: [
			{
				type: 'update',
				blockId: getEditorBlockId(config),
				code: [
					...config.code.slice(0, -1),
					'; @config midi.inputs.keys.port 0',
					'; @config midi.inputs.keys.callback onMidi',
					'noteEnd',
				],
			},
		],
	});
	const send = (status: number) => {
		const event = new Event('midimessage');
		Object.defineProperty(event, 'data', { value: new Uint8Array([status, 64, 127]) });
		input.dispatchEvent(event);
	};
	await vi.waitFor(
		() => {
			send(0x90);
			const address = editor.state.compiler.memoryPlan.modules.received.memory.status.allocationUnitAddress;
			expect(editor.getMemoryViews().int32[address]).toBe(0x90);
		},
		{ timeout: 10000 }
	);
	expect(requestAccess).toHaveBeenCalledOnce();
	expect(editor.state.info.midi).toEqual({ '0': 'Keys (in)' });
	expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
	const memory = editor.getMemoryViews().int32;
	const address = editor.state.compiler.memoryPlan.modules.received.memory.status.allocationUnitAddress;
	editor.dispose();
	send(0x80);
	expect(memory[address]).toBe(0x90);
});
