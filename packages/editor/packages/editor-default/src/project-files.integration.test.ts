import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { createCodeBlockCopyPastePlugin } from '@8f4e/editor-plugin-code-block-copy-paste';
import { createProjectFilesPlugin } from '@8f4e/editor-plugin-project-files';
import initState, { serializeToProject, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { expect, it } from 'vitest';
import { createEvents } from './__tests__/file-events';

it('keeps generated runtime values consistent across copy, paste, save and open', async () => {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	let savedSource = '';
	const handle = {
		getFile: async () => new File([savedSource], 'project.8f4e'),
		createWritable: async () => ({
			write: async (blob: Blob) => {
				savedSource = await blob.text();
			},
			close: async () => {},
			abort: async () => {},
		}),
	};
	const inputTarget = Object.assign(new EventTarget(), {
		ownerDocument: {
			defaultView: {
				showSaveFilePicker: async () => handle,
				showOpenFilePicker: async () => [handle],
			},
		},
	}) as unknown as HTMLElement;
	let clipboard = '';
	const plugins = [
		createProjectFilesPlugin({ inputTarget }),
		createCodeBlockCopyPastePlugin({
			readClipboardText: async () => clipboard,
			writeClipboardText: async text => {
				clipboard = text;
			},
		}),
	];
	const renderRegistry = createEditorRenderRegistry();
	const cleanups = plugins.map(plugin =>
		plugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			loading: store.loading,
			renderRegistry,
		})
	);
	try {
		setGridSize(state, events, TEST_GRID_SIZE);
		store.set('envConstantContributions.provider', ['const GENERATED 42']);
		events.dispatch('loadProject', {
			project: parseProjectSource(
				'8f4e/v1\nentry main\nmodule test\nuse env\nint value GENERATED\nmoduleEnd\nentryEnd'
			),
		});
		events.dispatch('enterEditMode');
		const readValue = async () => {
			const compiled = await compileProject(serializeToProject(state));
			const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
			const { instance } = await WebAssembly.instantiate(compiled.codeBuffer, { host: { memory } });
			(instance.exports.initDefaults as CallableFunction)();
			return new DataView(memory.buffer).getInt32(compiled.memoryPlan.modules.test.memory.value.byteAddress, true);
		};
		expect(await readValue()).toBe(42);
		const environment = state.project.rootLevel.blocks.find(block => block.readOnly && block.name === 'env')!;
		await events.dispatchAsync('copyCodeBlock', { codeBlock: environment });
		// Pasting after the generated block in source order used to shadow later contributions.
		await events.dispatchAsync('pasteCodeBlocks', { x: 400, y: 300 });
		store.set('envConstantContributions.provider', ['const GENERATED 99']);
		expect(await readValue()).toBe(99);
		await events.dispatchAsync('saveProject');
		expect(parseProjectSource(savedSource).constants).toHaveLength(1);
		expect(savedSource).toContain('const GENERATED 99');
		const original = state.project.rootLevel;
		await events.dispatchAsync('importProject');
		expect(state.project.rootLevel).not.toBe(original);
		const environments = state.project.rootLevel.blocks.filter(
			block => block.name === 'env' && block.blockType === 'constants'
		);
		expect(environments).toHaveLength(1);
		const [generated] = environments;
		expect(generated).toMatchObject({ gridX: 0, gridY: 0, readOnly: true });
		expect(await readValue()).toBe(99);
		store.set('envConstantContributions.provider', ['const GENERATED 100']);
		expect(await readValue()).toBe(100);
	} finally {
		while (cleanups.length) cleanups.pop()!();
		store.dispose();
	}
});
