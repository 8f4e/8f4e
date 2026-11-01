import { getEditorBlockId } from '@8f4e/editor-core';
import { type DefaultEditorInstance, mountDefaultEditor } from '@8f4e/editor-default';
import { serializeToProject } from '@8f4e/editor-state';
import { createEditorWebMcp, type WebMcpTool } from '@8f4e/editor-webmcp';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

const source = '8f4e/v1\nentry main\nmodule counter ; @mode edit\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

function setup(responses: Record<string, () => Promise<Response>>) {
	const id = Object.keys(responses)[0];
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) =>
		input === `/webmcp-${id}.8f4e` ? responses[id]() : fetch(input, options)
	);
	const panel = document.createElement('div');
	const canvas = document.createElement('canvas');
	canvas.style.width = '900px';
	canvas.style.height = '480px';
	panel.append(canvas);
	document.body.append(panel);
	let loaded = false;
	const pending = mountDefaultEditor(canvas, {
		initialProjectUrl: `/webmcp-${id}.8f4e`,
		storage: sessionStorage,
		storageNamespace: `8f4e-webmcp-test-${id}`,
		onInitialProjectLoaded: () => {
			loaded = true;
		},
	});
	const mounted = async (): Promise<DefaultEditorInstance> => {
		const editor = await pending;
		cleanups.push(() => editor.dispose());
		await vi.waitFor(() => expect(loaded).toBe(true));
		const bridge = createEditorWebMcp({ document, editor, getCompilerDiagnostics: editor.getCompilerDiagnostics });
		cleanups.push(() => bridge.dispose());
		await bridge.ready;
		return editor;
	};
	cleanups.push(() => {
		panel.remove();
		sessionStorage.removeItem(`project_8f4e-webmcp-test-${id}`);
	});
	return { panel: () => panel, mounted };
}

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

test('ships documentation and examples through the built bridge without changing the editor', async () => {
	const tools = siteTools();
	const view = setup({ reference: async () => new Response(source) });
	const editor = await view.mounted();
	const call = (name: string, args = {}) => tools.get(name)!.execute(args);
	const revision = editor.editing.getRevision();
	const blocks = editor.state.codeBlockRendering.codeBlocks;
	const help = (await call('get_help')) as string;
	expect(help).toContain('stack-based programming language');
	const docs = (await call('search_docs', { query: '@pos' })) as { results: Array<{ topic: string }> };
	expect(docs.results.some(result => result.topic === 'editor/editor-directives#pos')).toBe(true);
	expect(await call('get_docs', { topic: 'editor/editor-directives#pos' })).toContain('; @pos');
	const slider = (await call('search_docs', { query: 'slider' })) as { results: Array<{ summary: string }> };
	expect(slider.results[0].summary).toMatch(/^Render a slider/);
	const pointers = (await call('search_docs', { query: 'float*' })) as {
		results: Array<{ topic: string; summary: string }>;
	};
	expect(pointers.results.find(result => result.topic.endsWith('#float'))!.summary).toContain('float**');
	const directives = (await call('search_docs', { query: '#skipExecution' })) as { results: Array<{ title: string }> };
	expect(directives.results[0].title).toBe('#skipExecution');
	const effects = (await call('search_examples', { query: 'distortion', kind: 'block' })) as {
		results: Array<{ path: string; summary: string }>;
	};
	expect(effects.results.find(result => result.path === 'effects/bitcrusher')!.summary).toContain('quantiz');
	const examples = (await call('search_examples', { query: 'low pass filter', kind: 'block' })) as {
		results: Array<{ kind: string; path: string }>;
	};
	const block = examples.results[0];
	const code = await call('get_example', { kind: block.kind, path: block.path });
	expect(code).toMatch(/^module lowPassFilter\n/);
	expect(code).not.toContain('@public');
	expect(await call('get_example', { kind: 'project', path: 'audio/reverbGrouped' })).toContain('groupEnd');
	expect(editor.state.codeBlockRendering.codeBlocks).toBe(blocks);
	expect(editor.editing.getRevision()).toBe(revision);
	expect(await call('apply_edits', { edits: [{ operation: 'insert', code }] })).toMatchObject({
		error: { code: 'source_required' },
	});
	await call('get_project');
	expect(
		await call('apply_edits', {
			edits: [
				{
					operation: 'update',
					type: 'module',
					name: 'counter',
					code: help.match(/module counter\n[\s\S]*?moduleEnd/)![0],
				},
				{ operation: 'insert', code },
			],
		})
	).toBe('Edits applied.');
	expect(await call('get_block', { type: 'module', name: 'lowPassFilter' })).toContain('float alpha');
	await vi.waitFor(async () =>
		expect(await call('get_compiler_diagnostics')).toMatchObject({
			diagnostics: { status: 'ready', compilationErrors: [] },
		})
	);
});

test('navigates the editor and returns only the currently expanded source string', async () => {
	const tools = siteTools();
	const grouped =
		'8f4e/v1\nentry main\nmodule oscillator ; @mode edit\nint value 1\nmoduleEnd\ngroup audio\nmodule oscillator\nint value 2\nmoduleEnd\ngroup voices\nmodule deepSecret\nmoduleEnd\ngroupEnd\ngroupEnd\nentryEnd';
	const view = setup({ grouped: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
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
		'8f4e/v1\nnote colors\nroot palette\nnoteEnd\nentry main\ngroup audio\nnote colors\nvoice palette\nnoteEnd\nmodule oscillator ; @mode edit\nint value 1\nmoduleEnd\ngroupEnd\nentryEnd';
	const view = setup({ named: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
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
	expect(serializeToProject(editor.state).notes[0].code).toEqual(['note colors', 'root palette', 'noteEnd']);
	for (const tool of tools.values())
		expect(JSON.stringify(tool.inputSchema)).not.toMatch(/blockId|createdBlockIds|expectedRevision/);
});

test('patches one source span in the current group with persistence and one-step undo/redo', async () => {
	const tools = siteTools();
	const grouped =
		'8f4e/v1\nentry main\nmodule oscillator ; @mode edit\nfloat alpha 0.04\nmoduleEnd\ngroup audio\nmodule oscillator\n; @pos 10 4\nfloat alpha 0.04\npush alpha\ndrop\npush alpha\ndrop\nmoduleEnd\ngroupEnd\nentryEnd';
	const view = setup({ patched: async () => new Response(grouped) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
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
		serializeToProject(editor.state).groups.find(group => group.name === 'audio')!.modules[0].code;
	expect(serializeToProject(editor.state).modules[0].code).toContain('float alpha 0.04');
	expect(await call('get_project_metadata')).toMatchObject({ projectPath: 'audio' });
	expect(window.sessionStorage.getItem('project_8f4e-webmcp-test-patched')).toContain('float alpha 0.1');
	const project = serializeToProject(editor.state);
	const historyLength = editor.state.historyStack.length;
	for (const [oldText, error] of [
		['float alpha 0.04', 'match_not_found'],
		['push alpha', 'ambiguous_match'],
	] as const)
		expect(
			await call('patch_block', { type: 'module', name: 'oscillator', newText: 'float alpha 0.2', oldText })
		).toMatchObject({ error: { code: error } });
	expect(serializeToProject(editor.state)).toEqual(project);
	expect(editor.state.historyStack).toHaveLength(historyLength);
	await vi.waitFor(async () =>
		expect(await call('get_compiler_diagnostics')).toMatchObject({
			diagnostics: { status: 'ready', compilationErrors: [] },
		})
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
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
	const call = (name: string, args = {}) => tools.get(name)!.execute(args);
	await vi.waitFor(async () =>
		expect(await call('get_compiler_diagnostics')).toMatchObject({ diagnostics: { status: 'ready' } })
	);
	const patchValue = (from: number, to: number) =>
		call('patch_block', {
			type: 'module',
			name: 'counter',
			oldText: `int value ${from}`,
			newText: `int value ${to}`,
		});
	expect(await patchValue(1, 2)).toMatchObject({ error: { code: 'source_required' } });
	expect(await call('get_block', { type: 'module', name: 'counter' })).toContain('int value 1');
	expect(await patchValue(1, 2)).toBe('Block patched.');
	expect(await patchValue(2, 3)).toBe('Block patched.');
	expect(await call('apply_edits', { edits: [{ operation: 'insert', code: 'note colors\nblue\nnoteEnd' }] })).toBe(
		'Edits applied.'
	);
	expect(await call('undo')).toBe('Undo complete.');
	expect(await call('redo')).toBe('Redo complete.');
	const externalEdit = (value: number) => {
		const revision = editor.editing.getRevision();
		const target = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'counter')!;
		editor.editing.applyEdits({
			expectedRevision: revision,
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(target),
					code: ['module counter', `int value ${value}`, 'moduleEnd'],
				},
			],
		});
	};
	externalEdit(4);
	const externalProject = serializeToProject(editor.state);
	const externalHistory = editor.state.historyStack.length;
	for (const [tool, args] of [
		['update_block', { type: 'module', name: 'counter', code: source }],
		['patch_block', { type: 'module', name: 'counter', oldText: 'int value 4', newText: 'int value 5' }],
		['apply_edits', { edits: [{ operation: 'delete', type: 'module', name: 'counter' }] }],
		['undo', {}],
		['redo', {}],
	] as const)
		expect(await call(tool, args)).toMatchObject({
			error: { code: 'stale_revision', message: expect.stringContaining('Re-fetch') },
		});
	await call('get_project_metadata');
	await call('get_block_metadata', { type: 'module', name: 'counter' });
	await call('get_compiler_diagnostics');
	await call('go_to_parent');
	await call('go_to_root');
	await call('get_block', { type: 'module', name: 'missing' });
	await call('get_project', { name: 'root' });
	expect(await patchValue(4, 5)).toMatchObject({ error: { code: 'stale_revision' } });
	expect(serializeToProject(editor.state)).toEqual(externalProject);
	expect(editor.state.historyStack).toHaveLength(externalHistory);
	expect(await call('get_block', { type: 'module', name: 'counter' })).toContain('int value 4');
	expect(await patchValue(4, 5)).toBe('Block patched.');
	externalEdit(6);
	expect(await patchValue(6, 7)).toMatchObject({ error: { code: 'stale_revision' } });
	expect(await call('get_project')).toContain('int value 6');
	expect(await patchValue(6, 7)).toBe('Block patched.');
});

test('exposes source strings through site tools and saves undoable named edits', async () => {
	const tools = siteTools();
	const view = setup({ bridged: async () => new Response(source) });
	const editor = await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	canvas.style.width = '900px';
	canvas.style.height = '480px';
	editor.resize(900, 480);
	expect(await tools.get('get_project')!.execute({})).toContain('module counter');
	expect(await tools.get('get_block_metadata')!.execute({ type: 'module', name: 'counter' })).toMatchObject({
		block: { name: 'counter', type: 'module', entry: 'main' },
	});
	expect(
		await tools.get('apply_edits')!.execute({
			edits: [
				{
					operation: 'update',
					type: 'module',
					name: 'counter',
					code: 'module counter\n; @pos 0 14\nint value 17\nmoduleEnd',
				},
				{ operation: 'insert', code: 'note colors\n; @pos 40 14\nPosition comes from source\nnoteEnd' },
			],
		})
	).toBe('Edits applied.');
	expect(serializeToProject(editor.state).modules[0].code).toContain('int value 17');
	expect(window.sessionStorage.getItem('project_8f4e-webmcp-test-bridged')).toContain('int value 17');
	const blocks = editor.state.codeBlockRendering.codeBlocks;
	expect(blocks.find(block => block.name === 'counter')!).toMatchObject({
		gridX: 0,
		gridY: 14,
	});
	expect(blocks.find(block => block.name === 'colors')!).toMatchObject({
		gridX: 40,
		gridY: 14,
		code: ['note colors', '; @pos 40 14', 'Position comes from source', 'noteEnd'],
	});
	expect(window.sessionStorage.getItem('project_8f4e-webmcp-test-bridged')).toContain('@pos 40 14');
	editor.renderFrame();
	await page.screenshot({ element: view.panel(), path: '../.vitest-attachments/webmcp-edit.png' });
	await tools.get('undo')!.execute({});
	expect(serializeToProject(editor.state).modules[0].code).toContain('int value 1');
});
