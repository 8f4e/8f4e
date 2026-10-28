import { type DefaultEditorInstance, mountDefaultEditor } from '@8f4e/editor-default';
import type { WebMcpProjectSnapshot, WebMcpTool } from '@8f4e/editor-webmcp';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { mountGallery } from './gallery';

vi.mock('@8f4e/editor-default', { spy: true });

const source = '8f4e/v1\nentry main\nmodule galleryExample\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

function setup(responses: Record<string, () => Promise<Response>>) {
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
		const id = Object.keys(responses).find(id => input === `/gallery-${id}.8f4e`);
		return id ? responses[id]() : fetch(input, options);
	});
	const ids = Object.keys(responses);
	const originalUrl = window.location.href;
	window.history.replaceState(null, '', `#${ids[0]}`);
	const gallery = document.createElement('div');
	gallery.id = 'examples-gallery';
	document.body.append(gallery);
	const dispose = mountGallery({
		title: 'Examples',
		storageNamespace: 'gallery-test',
		categories: [
			{
				path: 'test',
				title: 'Test',
				projects: ids.map(id => ({
					id,
					title: id,
					description: 'A gallery fixture.',
					projectUrl: `/gallery-${id}.8f4e`,
					previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
					githubUrl: 'https://github.com/8f4e/8f4e',
				})),
			},
		],
	});
	cleanups.push(() => {
		dispose();
		gallery.remove();
		window.history.replaceState(null, '', originalUrl);
		for (const id of ids) window.sessionStorage.removeItem(`project_8f4e-gallery-test-${id}`);
	});
	const panel = (id = ids[0]) => gallery.querySelector<HTMLElement>(`#panel-${id}`)!;
	const mounted = async (index = 0): Promise<DefaultEditorInstance> => {
		await vi.waitFor(() => expect(mountDefaultEditor).toHaveBeenCalledTimes(index + 1));
		return await vi.mocked(mountDefaultEditor).mock.results[index].value;
	};
	return { gallery, panel, mounted };
}

test('keeps the editor mounted while a project fetch is pending and reveals it on completion', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ delayed: () => pending });
	const editor = await view.mounted();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	const canvas = view.panel().querySelector('canvas')!;
	expect(status.textContent).toBe('Loading project…');
	expect(canvas.isConnected).toBe(true);
	expect(canvas.classList.contains('editor-ready')).toBe(false);
	finish(new Response(source));
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
	expect(editor.state.initialProjectState?.modules[0].code).toContain('module galleryExample');
});

test('reveals a successfully loaded empty project', async () => {
	const view = setup({ empty: async () => new Response('8f4e/v1') });
	await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(view.panel().querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true);
});

test('compiles a loaded project through the compiler plugin and refreshes editor memory views', async () => {
	const configuredSource = source.replace('int value 1', '; @config recompileDebounceDelay 10\nint value 1');
	const view = setup({ compiled: async () => new Response(configuredSource) });
	const editor = await view.mounted();
	await vi.waitFor(
		() =>
			expect(Object.keys(editor.state.compiler.compiledModules).some(id => id.includes('galleryExample'))).toBe(true),
		{ timeout: 10000 }
	);
	expect(editor.state.codeErrors.compilationErrors).toEqual([]);
	expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(editor.state.editorConfig.recompileDebounceDelay).toBe(10);
	expect(editor.state.compiler.isCompiling).toBe(false);
	expect(editor.state.info.compiler?.wasmByteCodeBytes).toBeGreaterThan(0);
	expect(editor.getMemoryViews().int32.byteLength).toBeGreaterThan(0);
});

test('reports a failed request immediately and loads the project when retried', async () => {
	let requests = 0;
	const view = setup({
		retry: async () => {
			if (++requests === 1) throw new Error('Offline');
			return new Response(source);
		},
	});
	await view.mounted();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	await vi.waitFor(() => expect(status.textContent).toContain('This project could not be loaded.'));
	expect(view.panel().querySelector('canvas')).toBeNull();
	status.querySelector<HTMLButtonElement>('button')!.click();
	await view.mounted(1);
	await vi.waitFor(() => expect(view.panel().querySelector('canvas')?.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
});

test('disposes an editor when loading fails before its mount promise resolves', async () => {
	const dispose = vi.fn();
	vi.mocked(mountDefaultEditor).mockImplementationOnce(async (_canvas, options) => {
		options?.onInitialProjectLoadError?.(new Error('Offline'));
		return { dispose } as unknown as DefaultEditorInstance;
	});
	const view = setup({ early: async () => new Response(source) });
	await view.mounted();
	await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
	expect(view.panel().querySelector('canvas')).toBeNull();
	expect(view.panel().querySelector('[role="status"]')?.textContent).toContain('This project could not be loaded.');
});

test('switches examples without waiting for the previous fetch and ignores its late completion', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ first: () => pending, second: async () => new Response(source) });
	await view.mounted();
	const firstCanvas = view.panel('first').querySelector('canvas')!;
	view.gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
	await view.mounted(1);
	await vi.waitFor(() =>
		expect(view.panel('second').querySelector('canvas')?.classList.contains('editor-ready')).toBe(true)
	);
	expect(firstCanvas.isConnected).toBe(false);
	finish(new Response(source));
	await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
	expect(view.panel('second').querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true);
	expect(view.panel('second').querySelector('canvas')?.classList.contains('editor-ready')).toBe(true);
	expect(view.panel('first').querySelector('canvas')).toBeNull();
});

function siteTools() {
	const original = Object.getOwnPropertyDescriptor(document, 'modelContext');
	const tools = new Map<string, WebMcpTool>();
	Object.defineProperty(document, 'modelContext', {
		configurable: true,
		value: {
			registerTool(tool: WebMcpTool, { signal }: { signal: AbortSignal }) {
				tools.set(tool.name, tool);
				signal.addEventListener('abort', () => {
					if (tools.get(tool.name) === tool) tools.delete(tool.name);
				});
			},
		},
	});
	cleanups.push(() => {
		if (original) Object.defineProperty(document, 'modelContext', original);
		else Reflect.deleteProperty(document, 'modelContext');
	});
	return tools;
}

test('reads one source level at a time and expands a chosen nested group without navigating the editor', async () => {
	const tools = siteTools();
	const grouped =
		'8f4e/v1\nentry main\nmodule root\nmoduleEnd\ngroup audio\nmodule oscillator\nmoduleEnd\ngroup voices\nmodule deepSecret\nmoduleEnd\ngroupEnd\ngroupEnd\nentryEnd';
	const view = setup({ grouped: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const visibleBlocks = editor.state.codeBlockRendering.codeBlocks;
	const root = (await tools.get('get_project')!.execute({})) as WebMcpProjectSnapshot;
	expect(root.code).toContain('module root');
	expect(root.code).toContain('group audio');
	expect(root.code).not.toContain('module oscillator');
	const audio = root.blocks.find(block => root.code.split('\n')[block.startLine - 1] === 'group audio')!;
	const expanded = (await tools.get('expand_group')!.execute({ blockId: audio.blockId })) as WebMcpProjectSnapshot;
	expect(expanded.projectPath).toBe('audio');
	expect(expanded.code).toContain('module oscillator');
	expect(expanded.code).toContain('group voices');
	expect(expanded.code).not.toContain('deepSecret');
	const voices = expanded.blocks.find(block => expanded.code.split('\n')[block.startLine - 1] === 'group voices')!;
	const nested = (await tools.get('expand_group')!.execute({ blockId: voices.blockId })) as WebMcpProjectSnapshot;
	expect(nested.projectPath).toBe('audio/voices');
	expect(nested.code).toContain('module deepSecret');
	expect(editor.state.codeBlockRendering.codeBlocks).toBe(visibleBlocks);
	expect(nested.revision).toBe(root.revision);
});

test('exposes the loaded project through site tools and saves undoable source edits', async () => {
	const tools = siteTools();
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ bridged: () => pending });
	const editor = await view.mounted();
	expect(tools.size).toBe(0);
	finish(new Response(source));
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const canvas = view.panel().querySelector('canvas')!;
	canvas.style.width = '900px';
	canvas.style.height = '480px';
	editor.resize(900, 480);
	const before = (await tools.get('get_project')!.execute({})) as WebMcpProjectSnapshot;
	const target = before.blocks.find(block => before.code.split('\n')[block.startLine - 1] === 'module galleryExample')!;
	expect(target).toBeDefined();
	const metadata = await tools.get('get_block_metadata')!.execute({ blockId: target.blockId });
	expect(metadata).toMatchObject({
		revision: before.revision,
		block: { name: 'galleryExample', type: 'module', entry: 'main' },
	});
	const changed = (await tools.get('apply_edits')!.execute({
		expectedRevision: before.revision,
		edits: [
			{ type: 'update', blockId: target.blockId, code: 'module galleryExample\nint value 17\nmoduleEnd' },
			{ type: 'move', blockId: target.blockId, x: 0, y: 14 },
		],
	})) as { revision: string };
	expect(editor.editing.getSnapshot().project.modules[0].code).toContain('int value 17');
	expect(window.sessionStorage.getItem('project_8f4e-gallery-test-bridged')).toContain('int value 17');
	editor.renderFrame();
	await page.screenshot({ element: view.panel(), path: '../.vitest-attachments/webmcp-edit.png' });
	await tools.get('undo')!.execute({ expectedRevision: changed.revision });
	expect(editor.editing.getSnapshot().project.modules[0].code).toContain('int value 1');
});

test('replaces site tools on project selection and rejects retained calls and snapshots from the previous project', async () => {
	const tools = siteTools();
	const view = setup({
		first: async () => new Response(source),
		second: async () => new Response(source.replace('galleryExample', 'secondExample')),
	});
	await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const before = (await tools.get('get_project')!.execute({})) as WebMcpProjectSnapshot;
	const retained = tools.get('apply_edits')!;
	view.gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
	expect(tools.size).toBe(0);
	const editor = await view.mounted(1);
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const edits = [{ type: 'delete', blockId: before.blocks[0].blockId }];
	expect(await retained.execute({ expectedRevision: before.revision, edits })).toMatchObject({
		error: { code: 'disposed' },
	});
	expect(await tools.get('apply_edits')!.execute({ expectedRevision: before.revision, edits })).toMatchObject({
		error: { code: 'stale_revision' },
	});
	expect(editor.editing.getSnapshot().project.modules[0].code[0]).toBe('module secondExample');
	expect(tools.size).toBe(7);
});
