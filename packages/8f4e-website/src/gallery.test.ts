import { type DefaultEditorInstance, mountDefaultEditor } from '@8f4e/editor-default';
import type { WebMcpTool } from '@8f4e/editor-webmcp';
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

test('navigates the editor and returns only the currently expanded source string', async () => {
	const tools = siteTools();
	const grouped =
		'8f4e/v1\nentry main\nmodule oscillator\nint value 1\nmoduleEnd\ngroup audio\nmodule oscillator\nint value 2\nmoduleEnd\ngroup voices\nmodule deepSecret\nmoduleEnd\ngroupEnd\ngroupEnd\nentryEnd';
	const view = setup({ grouped: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const call = (name: string, args = {}) => tools.get(name)!.execute(args);
	const root = await call('get_project');
	expect(typeof root).toBe('string');
	expect(root).toContain('int value 1');
	expect(root).toContain('group audio');
	expect(root).not.toContain('int value 2');
	expect(await call('expand_group', { name: 'audio' })).toMatchObject({ projectPath: 'audio' });
	expect(editor.state.codeBlockRendering.codeBlocks).toBe(
		editor.state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'audio')!.nestedProjectCodeBlocks
	);
	const expanded = await call('get_project');
	expect(expanded).toContain('int value 2');
	expect(expanded).toContain('group voices');
	expect(expanded).not.toContain('deepSecret');
	expect(await call('get_block', { type: 'module', name: 'oscillator' })).toContain('int value 2');
	expect(
		await call('update_block', {
			type: 'module',
			name: 'oscillator',
			code: 'module oscillator\nint value 3\nmoduleEnd',
		})
	).toBe('Block updated.');
	expect(editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'oscillator')!.code).toContain(
		'int value 3'
	);
	expect(editor.state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'oscillator')!.code).toContain(
		'int value 1'
	);
	await call('expand_group', { name: 'voices' });
	expect(await call('get_project_metadata')).toMatchObject({ projectPath: 'audio/voices' });
	expect(await call('get_project')).toContain('module deepSecret');
	expect(editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'deepSecret')).toBeDefined();
	expect(await call('get_block', { type: 'module', name: 'oscillator' })).toMatchObject({
		error: { code: 'block_not_found' },
	});
	await call('go_to_parent');
	expect(await call('get_project')).toContain('int value 3');
	await call('go_to_root');
	expect(await call('get_project')).toBe(root);
});

test('targets named notes and modules through the same selectors without exposing identifiers', async () => {
	const tools = siteTools();
	const grouped =
		'8f4e/v1\nnote colors\nroot palette\nnoteEnd\nentry main\ngroup audio\nnote colors\nvoice palette\nnoteEnd\nmodule oscillator\nint value 1\nmoduleEnd\ngroupEnd\nentryEnd';
	const view = setup({ named: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const call = (name: string, args = {}) => tools.get(name)!.execute(args);
	expect(await call('get_block', { type: 'note', name: 'colors' })).toBe('note colors\nroot palette\nnoteEnd');
	await call('expand_group', { name: 'audio' });
	expect(await call('get_block', { type: 'note', name: 'colors' })).toBe('note colors\nvoice palette\nnoteEnd');
	expect(await call('get_block_metadata', { type: 'note', name: 'colors' })).toMatchObject({
		block: { type: 'note', name: 'colors', projectPath: 'audio', x: 0, y: 0 },
	});
	expect(
		await call('update_block', { type: 'note', name: 'colors', code: 'note palette\nupdated colors\nnoteEnd' })
	).toBe('Block updated.');
	expect(await call('get_block', { type: 'note', name: 'palette' })).toBe('note palette\nupdated colors\nnoteEnd');
	expect(await call('get_block', { type: 'note', name: 'colors' })).toMatchObject({
		error: { code: 'block_not_found' },
	});
	expect(
		await call('apply_edits', {
			edits: [
				{ operation: 'delete', type: 'note', name: 'palette' },
				{ operation: 'update', type: 'module', name: 'oscillator', code: 'module oscillator\nint value 4\nmoduleEnd' },
			],
		})
	).toBe('Edits applied.');
	expect(await call('get_project')).toContain('int value 4');
	expect(await call('get_project')).not.toContain('note palette');
	expect(editor.editing.getSnapshot().project.notes[0].code).toEqual(['note colors', 'root palette', 'noteEnd']);
	for (const tool of tools.values())
		expect(JSON.stringify(tool.inputSchema)).not.toMatch(/blockId|createdBlockIds|expectedRevision/);
});

test('patches one source span in the current group with persistence and one-step undo/redo', async () => {
	const tools = siteTools();
	const grouped =
		'8f4e/v1\nentry main\nmodule oscillator\nfloat alpha 0.04\nmoduleEnd\ngroup audio\nmodule oscillator\n; @pos 10 4\nfloat alpha 0.04\npush alpha\ndrop\npush alpha\ndrop\nmoduleEnd\ngroupEnd\nentryEnd';
	const view = setup({ patched: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const call = (name: string, args = {}) => tools.get(name)!.execute(args);
	await call('expand_group', { name: 'audio' });
	const original = (await call('get_block', { type: 'module', name: 'oscillator' })) as string;
	expect(
		await call('patch_block', {
			type: 'module',
			name: 'oscillator',
			oldText: 'float alpha 0.04',
			newText: 'float alpha 0.1',
		})
	).toBe('Block patched.');
	expect(await call('get_block', { type: 'module', name: 'oscillator' })).toBe(
		original.replace('float alpha 0.04', 'float alpha 0.1')
	);
	const childSource = () =>
		editor.editing.getSnapshot().project.groups.find(group => group.name === 'audio')!.modules[0].code;
	expect(editor.editing.getSnapshot().project.modules[0].code).toContain('float alpha 0.04');
	expect(await call('get_project_metadata')).toMatchObject({ projectPath: 'audio' });
	expect(window.sessionStorage.getItem('project_8f4e-gallery-test-patched')).toContain('float alpha 0.1');
	const project = editor.editing.getSnapshot().project;
	const historyLength = editor.state.historyStack.length;
	for (const [oldText, error] of [
		['float alpha 0.04', 'match_not_found'],
		['push alpha', 'ambiguous_match'],
	] as const)
		expect(
			await call('patch_block', { type: 'module', name: 'oscillator', newText: 'float alpha 0.2', oldText })
		).toMatchObject({ error: { code: error } });
	expect(editor.editing.getSnapshot().project).toEqual(project);
	expect(editor.state.historyStack).toHaveLength(historyLength);
	await vi.waitFor(async () =>
		expect(await call('get_diagnostics')).toMatchObject({ diagnostics: { status: 'ready', compilationErrors: [] } })
	);
	const canvas = view.panel().querySelector('canvas')!;
	canvas.style.width = '900px';
	canvas.style.height = '480px';
	editor.resize(900, 480);
	editor.renderFrame();
	await page.screenshot({ element: view.panel(), path: '../.vitest-attachments/webmcp-patch.png' });
	expect(await call('undo')).toBe('Undo complete.');
	expect(childSource().join('\n')).toBe(original);
	expect(await call('redo')).toBe('Redo complete.');
	expect(childSource().join('\n')).toBe(original.replace('float alpha 0.04', 'float alpha 0.1'));
});

test('tracks consecutive tool edits and requires source re-fetches after external edits', async () => {
	const tools = siteTools();
	const view = setup({ guarded: async () => new Response(source) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const call = (name: string, args = {}) => tools.get(name)!.execute(args);
	await vi.waitFor(async () =>
		expect(await call('get_diagnostics')).toMatchObject({ diagnostics: { status: 'ready' } })
	);
	const patchValue = (from: number, to: number) =>
		call('patch_block', {
			type: 'module',
			name: 'galleryExample',
			oldText: `int value ${from}`,
			newText: `int value ${to}`,
		});
	expect(await patchValue(1, 2)).toMatchObject({ error: { code: 'source_required' } });
	expect(await call('get_block', { type: 'module', name: 'galleryExample' })).toContain('int value 1');
	expect(await patchValue(1, 2)).toBe('Block patched.');
	expect(await patchValue(2, 3)).toBe('Block patched.');
	expect(await call('apply_edits', { edits: [{ operation: 'insert', code: 'note colors\nblue\nnoteEnd' }] })).toBe(
		'Edits applied.'
	);
	expect(await call('undo')).toBe('Undo complete.');
	expect(await call('redo')).toBe('Redo complete.');
	const externalEdit = (value: number) => {
		const snapshot = editor.editing.getSnapshot();
		const target = snapshot.blocks.find(({ block }) => block.name === 'galleryExample')!;
		editor.editing.applyEdits({
			expectedRevision: snapshot.revision,
			edits: [
				{ type: 'update', blockId: target.blockId, code: ['module galleryExample', `int value ${value}`, 'moduleEnd'] },
			],
		});
	};
	externalEdit(4);
	const externalProject = editor.editing.getSnapshot().project;
	const externalHistory = editor.state.historyStack.length;
	for (const [tool, args] of [
		['update_block', { type: 'module', name: 'galleryExample', code: source }],
		['patch_block', { type: 'module', name: 'galleryExample', oldText: 'int value 4', newText: 'int value 5' }],
		['apply_edits', { edits: [{ operation: 'delete', type: 'module', name: 'galleryExample' }] }],
		['undo', {}],
		['redo', {}],
	] as const)
		expect(await call(tool, args)).toMatchObject({
			error: { code: 'stale_revision', message: expect.stringContaining('Re-fetch') },
		});
	await call('get_project_metadata');
	await call('get_block_metadata', { type: 'module', name: 'galleryExample' });
	await call('get_diagnostics');
	await call('go_to_parent');
	await call('go_to_root');
	await call('get_block', { type: 'module', name: 'missing' });
	await call('get_project', { name: 'root' });
	expect(await patchValue(4, 5)).toMatchObject({ error: { code: 'stale_revision' } });
	expect(editor.editing.getSnapshot().project).toEqual(externalProject);
	expect(editor.state.historyStack).toHaveLength(externalHistory);
	expect(await call('get_block', { type: 'module', name: 'galleryExample' })).toContain('int value 4');
	expect(await patchValue(4, 5)).toBe('Block patched.');
	externalEdit(6);
	expect(await patchValue(6, 7)).toMatchObject({ error: { code: 'stale_revision' } });
	expect(await call('get_project')).toContain('int value 6');
	expect(await patchValue(6, 7)).toBe('Block patched.');
});

test('exposes source strings through site tools and saves undoable named edits', async () => {
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
	expect(await tools.get('get_project')!.execute({})).toContain('module galleryExample');
	expect(await tools.get('get_block_metadata')!.execute({ type: 'module', name: 'galleryExample' })).toMatchObject({
		block: { name: 'galleryExample', type: 'module', entry: 'main' },
	});
	expect(
		await tools.get('apply_edits')!.execute({
			edits: [
				{
					operation: 'update',
					type: 'module',
					name: 'galleryExample',
					code: 'module galleryExample\n; @pos 0 14\nint value 17\nmoduleEnd',
				},
				{ operation: 'insert', code: 'note colors\n; @pos 40 14\nPosition comes from source\nnoteEnd' },
			],
		})
	).toBe('Edits applied.');
	expect(editor.editing.getSnapshot().project.modules[0].code).toContain('int value 17');
	expect(window.sessionStorage.getItem('project_8f4e-gallery-test-bridged')).toContain('int value 17');
	const snapshot = editor.editing.getSnapshot();
	expect(snapshot.blocks.find(({ block }) => block.name === 'galleryExample')!.block).toMatchObject({
		gridX: 0,
		gridY: 14,
	});
	expect(snapshot.blocks.find(({ block }) => block.name === 'colors')!.block).toMatchObject({
		gridX: 40,
		gridY: 14,
		code: ['note colors', '; @pos 40 14', 'Position comes from source', 'noteEnd'],
	});
	expect(window.sessionStorage.getItem('project_8f4e-gallery-test-bridged')).toContain('@pos 40 14');
	editor.renderFrame();
	await page.screenshot({ element: view.panel(), path: '../.vitest-attachments/webmcp-edit.png' });
	await tools.get('undo')!.execute({});
	expect(editor.editing.getSnapshot().project.modules[0].code).toContain('int value 1');
});

test('replaces site tools and requires a fresh source read for the replacement editor', async () => {
	const tools = siteTools();
	const view = setup({
		first: async () => new Response(source),
		second: async () => new Response(source.replace('galleryExample', 'secondExample')),
	});
	await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	await tools.get('get_project')!.execute({});
	const retained = tools.get('apply_edits')!;
	view.gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
	expect(tools.size).toBe(0);
	const editor = await view.mounted(1);
	await vi.waitFor(() => expect(tools.has('get_diagnostics')).toBe(true));
	const args = { edits: [{ operation: 'delete', type: 'module', name: 'secondExample' }] };
	expect(await retained.execute(args)).toMatchObject({ error: { code: 'disposed' } });
	await tools.get('get_project_metadata')!.execute({});
	expect(await tools.get('apply_edits')!.execute(args)).toMatchObject({ error: { code: 'source_required' } });
	expect(editor.editing.getSnapshot().project.modules[0].code[0]).toBe('module secondExample');
	expect(await tools.get('get_project')!.execute({})).toContain('module secondExample');
	expect(await tools.get('apply_edits')!.execute(args)).toBe('Edits applied.');
	expect(editor.editing.getSnapshot().project.modules).toHaveLength(0);
	expect(tools.size).toBe(13);
});
