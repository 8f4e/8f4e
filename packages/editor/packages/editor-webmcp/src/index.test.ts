import type { EditorEditingHandle } from '@8f4e/editor-core';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createEditorWebMcp, type WebMcpTool } from './index';

function setup() {
	const tools = new Map<string, WebMcpTool>();
	const registerTool = vi.fn((tool: WebMcpTool, { signal }: { signal: AbortSignal }) => {
		tools.set(tool.name, tool);
		signal.addEventListener('abort', () => {
			if (tools.get(tool.name) === tool) tools.delete(tool.name);
		});
	});
	const document = { modelContext: { registerTool } } as unknown as Document;
	const code = ['module counter', '; @pos 10 20', 'int value 0', 'moduleEnd'];
	const state = createMockState({ compilerInputRevision: 1, editorMode: 'edit' });
	state.codeBlockRendering.rootProject.blocks = [
		createMockCodeBlock({
			creationIndex: 7,
			projectPath: '',
			blockType: 'module',
			name: 'counter',
			code,
			gridX: 10,
			gridY: 20,
			entry: 'main',
		}),
	];
	state.codeBlockRendering.currentProject.blocks = state.codeBlockRendering.rootProject.blocks;
	let currentRevision = 'editor-one:1';
	let version = 1;
	const advance = () => {
		version += 7; // The bridge must use the returned token rather than assuming a single increment.
		currentRevision = `editor-one:${version}`;
		return { revision: currentRevision };
	};
	const editing: EditorEditingHandle = {
		getRevision: vi.fn(() => currentRevision),
		applyEdits: vi.fn(() => ({ ...advance(), createdBlockIds: ['private-created-handle'] })),
		undo: vi.fn(advance),
		redo: vi.fn(advance),
	};
	const navigation = { openGroup: vi.fn(), goToParentGroup: vi.fn(), goToRoot: vi.fn() };
	return {
		tools,
		registerTool,
		document,
		editing,
		navigation,
		state,
		get revision() {
			return currentRevision;
		},
		set revision(value: string) {
			currentRevision = value;
		},
	};
}

async function connect(
	view: ReturnType<typeof setup>,
	options: { readSource?: boolean; getCompilerDiagnostics?: () => unknown } = {}
) {
	const bridge = createEditorWebMcp({
		document: view.document,
		editor: { editing: view.editing, navigation: view.navigation, state: view.state },
		getCompilerDiagnostics: options.getCompilerDiagnostics,
	});
	await bridge.ready;
	const call = (name: string, args: object = {}) => view.tools.get(name)!.execute(args);
	if (options.readSource !== false) await call('get_project');
	return { bridge, call };
}

const update = { type: 'module', name: 'counter', code: 'module counter\nint value 3\nmoduleEnd' };
const patch = { type: 'module', name: 'counter', oldText: 'int value 0', newText: 'int value 3' };
const batch = { edits: [{ operation: 'insert', code: 'note colors\nnoteEnd' }] };
const writes = [
	['update_block', update],
	['patch_block', patch],
	['apply_edits', batch],
	['undo', {}],
	['redo', {}],
] as const;

describe('single-editor WebMCP bridge', () => {
	it('reports editability from the current editor mode', async () => {
		const view = setup();
		const { bridge, call } = await connect(view);
		try {
			view.state.editorMode = 'view';
			expect(await call('get_project_metadata')).toMatchObject({ editable: false });
			view.state.editorMode = 'edit';
			expect(await call('get_project_metadata')).toMatchObject({ editable: true });
		} finally {
			bridge.dispose();
		}
	});

	it('returns source strings and leaves revisions out of tool inputs', async () => {
		const view = setup();
		const before = structuredClone(view.state.codeBlockRendering.rootProject.blocks);
		const { bridge, call } = await connect(view, {
			readSource: false,
			getCompilerDiagnostics: () => ({ status: 'pending', completedRevision: null }),
		});
		expect([...view.tools.keys()]).toEqual([
			'get_help',
			'search_docs',
			'get_docs',
			'search_examples',
			'get_example',
			'get_project',
			'get_project_metadata',
			'expand_group',
			'go_to_parent',
			'go_to_root',
			'get_block',
			'update_block',
			'patch_block',
			'get_block_metadata',
			'apply_edits',
			'undo',
			'redo',
			'get_compiler_diagnostics',
		]);
		expect(await call('get_project')).toBe(
			'8f4e/v1\n\nentry main\n\n' + view.state.codeBlockRendering.rootProject.blocks[0].code.join('\n') + '\nentryEnd'
		);
		expect(await call('get_block', { type: 'module', name: 'counter' })).toBe(
			view.state.codeBlockRendering.rootProject.blocks[0].code.join('\n')
		);
		expect(await call('get_project_metadata')).toEqual({
			revision: 'editor-one:1',
			projectPath: '',
			editable: true,
			canUndo: false,
			canRedo: false,
		});
		expect(await call('get_block_metadata', { type: 'module', name: 'counter' })).toEqual({
			revision: 'editor-one:1',
			block: { projectPath: '', type: 'module', name: 'counter', x: 10, y: 20, entry: 'main' },
		});
		expect(await call('get_compiler_diagnostics')).toEqual({
			revision: 'editor-one:1',
			compilerInputRevision: 1,
			diagnostics: { status: 'pending', completedRevision: null },
		});
		for (const tool of view.tools.values())
			expect(JSON.stringify(tool.inputSchema)).not.toMatch(/blockId|createdBlockIds|expectedRevision/);
		expect(view.state.codeBlockRendering.rootProject.blocks).toEqual(before);
		bridge.dispose();
	});

	it('serves bundled reference tools without acknowledging live source changes', async () => {
		const view = setup();
		const { bridge, call } = await connect(view, { readSource: false });
		const referenceCalls = [
			['get_help', {}],
			['search_docs', { query: 'push' }],
			['get_docs', { topic: 'compiler/instructions/stack#push' }],
			['search_examples', { query: 'low pass filter', kind: 'block' }],
			['get_example', { kind: 'block', path: 'filters/lowPassFilter' }],
		] as const;
		const before = structuredClone(view.state.codeBlockRendering.rootProject.blocks);
		for (const [name, args] of referenceCalls) {
			expect(view.tools.get(name)!.annotations.readOnlyHint).toBe(true);
			expect(await call(name, args)).not.toHaveProperty('error');
		}
		expect(view.state.codeBlockRendering.rootProject.blocks).toEqual(before);
		expect(view.state.historyStack).toHaveLength(0);
		expect(view.editing.getRevision).not.toHaveBeenCalled();
		expect(view.navigation.openGroup).not.toHaveBeenCalled();
		expect(await call('undo')).toMatchObject({ error: { code: 'source_required' } });
		await call('get_project');
		view.revision = 'external:2';
		for (const [name, args] of referenceCalls) await call(name, args);
		expect(await call('update_block', update)).toMatchObject({ error: { code: 'stale_revision' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		expect(await call('get_docs', { topic: 'unknown' })).toMatchObject({ error: { code: 'documentation_not_found' } });
		expect(await call('get_example', { kind: 'block', path: 'unknown' })).toMatchObject({
			error: { code: 'example_not_found' },
		});
		expect(await call('search_docs', { query: '', offset: -1 })).toMatchObject({ error: { code: 'invalid_request' } });
		expect(await call('search_examples', { query: '', kind: 'other' })).toMatchObject({
			error: { code: 'invalid_request' },
		});
		expect(await call('get_help', { query: '' })).toMatchObject({ error: { code: 'invalid_request' } });
		bridge.dispose();
	});

	it('rejects cancelled and disposed lazy reference reads', async () => {
		const view = setup();
		const { bridge } = await connect(view, { readSource: false });
		const controller = new AbortController();
		const pending = view.tools
			.get('get_example')!
			.execute({ kind: 'block', path: 'filters/lowPassFilter' }, { signal: controller.signal });
		controller.abort();
		expect(await pending).toMatchObject({ error: { code: 'cancelled' } });
		const reading = view.tools.get('get_docs')!.execute({ topic: 'compiler/source-syntax' });
		bridge.dispose();
		expect(await reading).toMatchObject({ error: { code: 'disposed' } });
	});

	it('requires a successful source fetch before every kind of initial write', async () => {
		const view = setup();
		const { bridge, call } = await connect(view, {
			readSource: false,
			getCompilerDiagnostics: () => ({ status: 'ready' }),
		});
		await call('get_project_metadata');
		await call('get_block_metadata', { type: 'module', name: 'counter' });
		await call('get_compiler_diagnostics');
		await call('go_to_root');
		await call('go_to_parent');
		expect(await call('get_block', { type: 'module', name: 'missing' })).toMatchObject({
			error: { code: 'block_not_found' },
		});
		expect(await call('get_project', { name: 'root' })).toMatchObject({ error: { code: 'invalid_request' } });
		for (const [name, args] of writes)
			expect(await call(name, args)).toMatchObject({ error: { code: 'source_required' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		expect(view.editing.undo).not.toHaveBeenCalled();
		expect(view.editing.redo).not.toHaveBeenCalled();
		await call('get_block', { type: 'module', name: 'counter' });
		expect(await call('update_block', update)).toBe('Block updated.');
		bridge.dispose();
	});

	it('advances its baseline after consecutive edits and history actions using exact result tokens', async () => {
		const view = setup();
		const { bridge, call } = await connect(view);
		for (const [name, args] of writes) expect(typeof (await call(name, args))).toBe('string');
		expect(vi.mocked(view.editing.applyEdits).mock.calls.map(([request]) => request.expectedRevision)).toEqual([
			'editor-one:1',
			'editor-one:8',
			'editor-one:15',
		]);
		expect(view.editing.undo).toHaveBeenCalledWith({ expectedRevision: 'editor-one:22' });
		expect(view.editing.redo).toHaveBeenCalledWith({ expectedRevision: 'editor-one:29' });
		bridge.dispose();
	});

	it.each(['get_project', 'get_block'])(
		'requires a source re-fetch after external changes, recovering through %s',
		async sourceTool => {
			const view = setup();
			const { bridge, call } = await connect(view, { getCompilerDiagnostics: () => ({ status: 'ready' }) });
			await call('update_block', update);
			view.revision = 'external-editor:80';
			view.state.codeBlockRendering.rootProject.blocks[0].code[2] = 'int value 9';
			const changedSource = structuredClone(view.state.codeBlockRendering.rootProject.blocks);
			for (const [name, args] of writes)
				expect(await call(name, args)).toMatchObject({
					error: { code: 'stale_revision', message: expect.stringContaining('Re-fetch') },
				});
			await call('get_project_metadata');
			await call('get_block_metadata', { type: 'module', name: 'counter' });
			await call('get_compiler_diagnostics');
			await call('go_to_root');
			await call('go_to_parent');
			await call('get_block', { type: 'module', name: 'missing' });
			await call('get_project', { name: 'root' });
			expect(await call('update_block', update)).toMatchObject({ error: { code: 'stale_revision' } });
			expect(view.editing.applyEdits).toHaveBeenCalledTimes(1);
			expect(view.editing.undo).not.toHaveBeenCalled();
			expect(view.editing.redo).not.toHaveBeenCalled();
			expect(view.state.codeBlockRendering.rootProject.blocks).toEqual(changedSource);
			expect(await call(sourceTool, sourceTool === 'get_block' ? { type: 'module', name: 'counter' } : {})).toContain(
				'int value 9'
			);
			expect(await call('update_block', update)).toBe('Block updated.');
			expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
				expectedRevision: 'external-editor:80',
				edits: [{ type: 'update', blockId: '["",7]', code: update.code.split('\n') }],
			});
			bridge.dispose();
		}
	);

	it('does not advance its baseline on failed writes and preserves the core revision guard', async () => {
		const view = setup();
		const { bridge, call } = await connect(view);
		vi.mocked(view.editing.applyEdits).mockImplementationOnce(() => {
			throw Object.assign(new Error('View mode'), { code: 'read_only' });
		});
		expect(await call('update_block', update)).toMatchObject({ error: { code: 'read_only' } });
		expect(await call('update_block', update)).toBe('Block updated.');
		vi.mocked(view.editing.applyEdits).mockImplementationOnce(() => {
			view.revision = 'external-editor:99';
			throw Object.assign(new Error('Changed during command'), {
				code: 'stale_revision',
				revision: view.revision,
			});
		});
		expect(await call('update_block', update)).toEqual({
			error: { code: 'stale_revision', message: expect.stringContaining('Re-fetch') },
		});
		expect(await call('update_block', update)).toMatchObject({ error: { code: 'stale_revision' } });
		expect(view.editing.applyEdits).toHaveBeenCalledTimes(3);
		await call('get_project');
		expect(await call('update_block', update)).toBe('Block updated.');
		bridge.dispose();
	});

	it('resolves batch targets by type and name and returns a simple confirmation', async () => {
		const view = setup();
		const { bridge, call } = await connect(view);
		expect(
			await call('apply_edits', {
				edits: [
					{ operation: 'insert', code: 'note colors\n\nhello\r\nnoteEnd\n' },
					{
						operation: 'update',
						type: 'module',
						name: 'counter',
						code: 'module renamed\n; @pos -20 30\nmoduleEnd',
						entry: 'secondary',
					},
					{ operation: 'delete', type: 'module', name: 'counter' },
				],
			})
		).toBe('Edits applied.');
		expect(view.editing.applyEdits).toHaveBeenCalledWith({
			expectedRevision: 'editor-one:1',
			edits: [
				{ type: 'insert', projectPath: '', code: ['note colors', '', 'hello', 'noteEnd', ''] },
				{
					type: 'update',
					blockId: '["",7]',
					code: ['module renamed', '; @pos -20 30', 'moduleEnd'],
					entry: 'secondary',
				},
				{ type: 'delete', blockId: '["",7]' },
			],
		});
		bridge.dispose();
	});

	it.each([
		{
			oldText: 'int value 0',
			newText: 'int value 3',
			expected: ['module counter', '; @pos 10 20', 'int value 3', 'moduleEnd'],
		},
		{
			oldText: '; @pos 10 20\r\nint value 0',
			newText: '; @pos -4 8\rint value 3\n; $& is literal\n',
			expected: ['module counter', '; @pos -4 8', 'int value 3', '; $& is literal', '', 'moduleEnd'],
		},
		{ oldText: 'int value 0\n', newText: '', expected: ['module counter', '; @pos 10 20', 'moduleEnd'] },
	])('patches one literal source span and preserves the rest: $oldText', async ({ oldText, newText, expected }) => {
		const view = setup();
		const before = structuredClone(view.state.codeBlockRendering.rootProject.blocks);
		const { bridge, call } = await connect(view);
		expect(await call('patch_block', { type: 'module', name: 'counter', oldText, newText })).toBe('Block patched.');
		expect(view.editing.applyEdits).toHaveBeenCalledExactlyOnceWith({
			expectedRevision: 'editor-one:1',
			edits: [{ type: 'update', blockId: '["",7]', code: expected }],
		});
		expect(view.state.codeBlockRendering.rootProject.blocks).toEqual(before);
		expect(view.tools.get('patch_block')!.annotations.readOnlyHint).toBe(false);
		bridge.dispose();
	});

	it('rejects invalid, missing, and ambiguous patches without applying edits', async () => {
		const view = setup();
		const { bridge, call } = await connect(view);
		for (const args of [
			{ oldText: '' },
			{ oldText: null },
			{ newText: null },
			{ blockId: '["",7]' },
			{ projectPath: '' },
			{ expectedRevision: 'old' },
		])
			expect(await call('patch_block', { ...patch, ...args })).toMatchObject({ error: { code: 'invalid_request' } });
		expect(await call('patch_block', { ...patch, oldText: 'absent source' })).toMatchObject({
			error: { code: 'match_not_found' },
		});
		view.state.codeBlockRendering.rootProject.blocks[0].code = ['module counter', '; aaa', 'moduleEnd'];
		for (const oldText of ['aa', 'module'])
			expect(await call('patch_block', { ...patch, oldText })).toMatchObject({ error: { code: 'ambiguous_match' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		bridge.dispose();
	});

	it('uses the current editor scope for every named block operation', async () => {
		const view = setup();
		const child = createMockCodeBlock({
			creationIndex: 1,
			projectPath: 'audio',
			name: 'counter',
			blockType: 'module',
			code: ['module counter', 'int value 9', 'moduleEnd'],
		});
		const note = createMockCodeBlock({
			creationIndex: 2,
			projectPath: 'audio',
			name: 'counter',
			blockType: 'note',
			code: ['note counter', 'colors', 'noteEnd'],
		});
		const group = createMockCodeBlock({
			creationIndex: 3,
			projectPath: '',
			name: 'audio',
			code: ['group audio', 'groupEnd'],
			childProject: { path: 'audio', blocks: [child, note] },
		});
		view.state.codeBlockRendering.rootProject.blocks.push(
			group,
			createMockCodeBlock({
				creationIndex: 4,
				projectPath: '',
				name: 'rootOnly',
				blockType: 'module',
				code: ['module rootOnly', 'moduleEnd'],
			})
		);
		view.navigation.openGroup.mockImplementation(() => {
			view.state.codeBlockRendering.currentProject = group.childProject!;
		});
		view.navigation.goToParentGroup.mockImplementation(() => {
			view.state.codeBlockRendering.currentProject = view.state.codeBlockRendering.rootProject;
		});
		view.navigation.goToRoot.mockImplementation(() => {
			view.state.codeBlockRendering.currentProject = view.state.codeBlockRendering.rootProject;
		});
		const { bridge, call } = await connect(view);
		await call('expand_group', { name: 'audio' });
		expect(view.navigation.openGroup).toHaveBeenCalledWith('["",3]');
		expect(await call('get_project')).toContain('int value 9');
		expect(await call('get_project')).not.toContain('rootOnly');
		expect(await call('get_block', { type: 'module', name: 'counter' })).toBe(child.code.join('\n'));
		expect(await call('get_block', { type: 'note', name: 'counter' })).toBe(note.code.join('\n'));
		await call('patch_block', { ...patch, oldText: 'int value 9' });
		expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
			expectedRevision: 'editor-one:1',
			edits: [{ type: 'update', blockId: '["audio",1]', code: ['module counter', 'int value 3', 'moduleEnd'] }],
		});
		await call('apply_edits', {
			edits: [
				{ operation: 'delete', type: 'note', name: 'counter' },
				{ operation: 'insert', code: 'note colors\nnoteEnd' },
			],
		});
		expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
			expectedRevision: 'editor-one:8',
			edits: [
				{ type: 'delete', blockId: '["audio",2]' },
				{ type: 'insert', projectPath: 'audio', code: ['note colors', 'noteEnd'] },
			],
		});
		const argsFor = (tool: string, name: string) => ({
			type: 'module',
			name,
			...(tool === 'update_block' ? { code: update.code } : {}),
			...(tool === 'patch_block' ? { oldText: 'int value 9', newText: 'int value 10' } : {}),
		});
		for (const tool of ['get_block', 'get_block_metadata', 'update_block', 'patch_block'])
			expect(await call(tool, argsFor(tool, 'rootOnly'))).toMatchObject({ error: { code: 'block_not_found' } });
		vi.mocked(view.editing.applyEdits).mockClear();
		expect(
			await call('apply_edits', {
				edits: [
					{ operation: 'update', type: 'module', name: 'counter', code: child.code.join('\n') },
					{ operation: 'delete', type: 'module', name: 'rootOnly' },
				],
			})
		).toMatchObject({ error: { code: 'block_not_found' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		group.childProject!.blocks.push(createMockCodeBlock({ ...child, creationIndex: 5 }));
		for (const tool of ['get_block', 'get_block_metadata', 'update_block', 'patch_block'])
			expect(await call(tool, argsFor(tool, 'counter'))).toMatchObject({ error: { code: 'ambiguous_block' } });
		expect(
			await call('apply_edits', { edits: [{ operation: 'delete', type: 'module', name: 'counter' }] })
		).toMatchObject({ error: { code: 'ambiguous_block' } });
		bridge.dispose();
	});

	it('rejects identifiers, coordinates, routing arguments, and caller-supplied revisions', async () => {
		const view = setup();
		const { bridge, call } = await connect(view);
		for (const [name, args] of writes)
			expect(await call(name, { ...args, expectedRevision: view.revision })).toMatchObject({
				error: { code: 'invalid_request' },
			});
		for (const edits of [
			[],
			[{ operation: 'insert', code: update.code, x: 1 }],
			[{ operation: 'insert', code: update.code, y: 2 }],
			[{ operation: 'insert', code: update.code, projectPath: '' }],
			[{ operation: 'update', type: 'module', name: 'counter', code: ['old array format'] }],
			[{ operation: 'delete', blockId: '["",7]' }],
			[{ operation: 'move', type: 'module', name: 'counter', x: 1, y: 2 }],
		])
			expect(await call('apply_edits', { edits })).toMatchObject({ error: { code: 'invalid_request' } });
		expect(await call('get_block_metadata', { blockId: '["",7]' })).toMatchObject({
			error: { code: 'invalid_request' },
		});
		expect(await call('undo', { editorId: 'other' })).toMatchObject({ error: { code: 'invalid_request' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		bridge.dispose();
	});

	it('does not share its source baseline with a replacement bridge or retained tools', async () => {
		const view = setup();
		const first = await connect(view);
		const retained = view.tools.get('apply_edits')!;
		expect(() =>
			createEditorWebMcp({
				document: view.document,
				editor: { editing: view.editing, navigation: view.navigation, state: view.state },
			})
		).toThrow('Only one');
		first.bridge.dispose();
		first.bridge.dispose();
		const second = await connect(view, { readSource: false });
		expect(await retained.execute(batch)).toMatchObject({ error: { code: 'disposed' } });
		await second.call('get_project_metadata');
		expect(await second.call('apply_edits', batch)).toMatchObject({ error: { code: 'source_required' } });
		await second.call('get_project');
		expect(await second.call('apply_edits', batch)).toBe('Edits applied.');
		second.bridge.dispose();
	});

	it('rejects cancelled source reads and writes without refreshing its baseline', async () => {
		const view = setup();
		const { bridge, call } = await connect(view, { readSource: false });
		const controller = new AbortController();
		controller.abort();
		expect(await view.tools.get('get_project')!.execute({}, { signal: controller.signal })).toMatchObject({
			error: { code: 'cancelled' },
		});
		expect(await call('undo')).toMatchObject({ error: { code: 'source_required' } });
		await call('get_project');
		expect(await view.tools.get('undo')!.execute({}, { signal: controller.signal })).toMatchObject({
			error: { code: 'cancelled' },
		});
		expect(view.editing.undo).not.toHaveBeenCalled();
		bridge.dispose();
	});

	it('cleans up partial registrations on failure and supports disposal during registration', async () => {
		const view = setup();
		view.registerTool.mockImplementationOnce(view.registerTool.getMockImplementation()!).mockImplementationOnce(() => {
			throw new Error('Browser denied registration');
		});
		const failed = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation, state: view.state },
		});
		await expect(failed.ready).rejects.toThrow('denied registration');
		expect(view.tools.size).toBe(0);
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation, state: view.state },
		});
		bridge.dispose();
		await bridge.ready;
		expect(view.tools.size).toBe(0);
	});

	it('leaves unsupported browsers operational', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: {} as Document,
			editor: { editing: view.editing, navigation: view.navigation, state: view.state },
		});
		expect(bridge.supported).toBe(false);
		await bridge.ready;
		bridge.dispose();
		expect(view.editing.getRevision).not.toHaveBeenCalled();
	});
});
