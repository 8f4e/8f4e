import type { EditorEditingHandle, EditorProjectSnapshot } from '@8f4e/editor-core';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
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
	const snapshot: EditorProjectSnapshot = {
		revision: 'editor-one:1',
		projectPath: '',
		compilerInputRevision: 1,
		project: {
			code: [],
			modules: [{ id: 7, entry: 'main', code }],
			functions: [],
			constants: [],
			prototypes: [],
			includes: [],
			notes: [],
			unknown: [],
			groups: [],
		},
		blocks: [
			{
				blockId: 'counter-handle',
				block: createMockCodeBlock({
					creationIndex: 7,
					projectPath: '',
					blockType: 'module',
					name: 'counter',
					code,
					gridX: 10,
					gridY: 20,
					x: 80,
					y: 320,
					entry: 'main',
				}),
			},
		],
		editable: true,
		canUndo: false,
		canRedo: false,
	};
	const editing: EditorEditingHandle = {
		getSnapshot: vi.fn(() => snapshot),
		applyEdits: vi.fn(() => ({ revision: 'editor-one:2', createdBlockIds: [] })),
		undo: vi.fn(() => ({ revision: 'editor-one:3', createdBlockIds: [] })),
		redo: vi.fn(() => ({ revision: 'editor-one:4', createdBlockIds: [] })),
	};
	const navigation = { openGroup: vi.fn(), goToParentGroup: vi.fn(), goToRoot: vi.fn() };
	return { tools, registerTool, document, editing, navigation, snapshot };
}

describe('single-editor WebMCP bridge', () => {
	it('returns project source with its matching revision and keeps the editor snapshot complete', async () => {
		const view = setup();
		const before = structuredClone(view.snapshot);
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
			getDiagnostics: () => ({ status: 'pending', completedRevision: null }),
		});
		await bridge.ready;
		const call = (name: string, args = {}) => view.tools.get(name)!.execute(args);
		expect([...view.tools.keys()]).toEqual([
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
			'get_diagnostics',
		]);
		expect(await call('get_project')).toEqual({
			code: '8f4e/v1\n\nentry main\n\n' + view.snapshot.blocks[0].block.code.join('\n') + '\nentryEnd',
			revision: view.snapshot.revision,
		});
		expect(await call('get_block', { type: 'module', name: 'counter' })).toBe(
			view.snapshot.blocks[0].block.code.join('\n')
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
		expect(await call('get_diagnostics')).toEqual({
			revision: 'editor-one:1',
			compilerInputRevision: 1,
			diagnostics: { status: 'pending', completedRevision: null },
		});
		for (const tool of view.tools.values()) {
			expect(JSON.stringify(tool.inputSchema)).not.toMatch(/blockId|createdBlockIds/);
		}
		expect(view.snapshot).toEqual(before);
		bridge.dispose();
	});

	it('resolves all batch targets by type and name and returns no editor identifiers', async () => {
		const view = setup();
		vi.mocked(view.editing.applyEdits).mockReturnValue({
			revision: 'editor-one:2',
			createdBlockIds: ['private-created-handle'],
		});
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		const result = await view.tools.get('apply_edits')!.execute({
			expectedRevision: view.snapshot.revision,
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
		});
		expect(result).toEqual({ revision: 'editor-one:2' });
		expect(view.editing.applyEdits).toHaveBeenCalledWith({
			expectedRevision: view.snapshot.revision,
			edits: [
				{ type: 'insert', projectPath: '', code: ['note colors', '', 'hello', 'noteEnd', ''] },
				{
					type: 'update',
					blockId: 'counter-handle',
					code: ['module renamed', '; @pos -20 30', 'moduleEnd'],
					entry: 'secondary',
				},
				{ type: 'delete', blockId: 'counter-handle' },
			],
		});
		expect(
			await view.tools.get('update_block')!.execute({
				type: 'module',
				name: 'counter',
				expectedRevision: view.snapshot.revision,
				code: 'module counter\nmoduleEnd',
			})
		).toEqual({ revision: 'editor-one:2' });
		expect(await view.tools.get('undo')!.execute({ expectedRevision: view.snapshot.revision })).toEqual({
			revision: 'editor-one:3',
		});
		expect(await view.tools.get('redo')!.execute({ expectedRevision: view.snapshot.revision })).toEqual({
			revision: 'editor-one:4',
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
		const before = structuredClone(view.snapshot);
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		expect(
			await view.tools
				.get('patch_block')!
				.execute({ type: 'module', name: 'counter', expectedRevision: view.snapshot.revision, oldText, newText })
		).toEqual({ revision: 'editor-one:2' });
		expect(view.editing.applyEdits).toHaveBeenCalledExactlyOnceWith({
			expectedRevision: view.snapshot.revision,
			edits: [{ type: 'update', blockId: 'counter-handle', code: expected }],
		});
		expect(view.snapshot).toEqual(before);
		expect(view.tools.get('patch_block')!.annotations.readOnlyHint).toBe(false);
		bridge.dispose();
	});

	it('rejects invalid, missing, ambiguous, and stale patches without applying edits', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		const patch = (args: object) =>
			view.tools.get('patch_block')!.execute({
				type: 'module',
				name: 'counter',
				expectedRevision: view.snapshot.revision,
				oldText: 'int value 0',
				newText: 'int value 3',
				...args,
			});
		for (const args of [
			{ oldText: '' },
			{ oldText: null },
			{ newText: null },
			{ blockId: 'counter-handle' },
			{ projectPath: '' },
		]) {
			expect(await patch(args)).toMatchObject({ error: { code: 'invalid_request' } });
		}
		expect(await patch({ oldText: 'absent source' })).toMatchObject({
			error: { code: 'match_not_found', revision: view.snapshot.revision },
		});
		view.snapshot.blocks[0].block.code = ['module counter', '; aaa', 'moduleEnd'];
		expect(await patch({ oldText: 'aa' })).toMatchObject({ error: { code: 'ambiguous_match' } });
		expect(await patch({ oldText: 'module' })).toMatchObject({ error: { code: 'ambiguous_match' } });
		expect(await patch({ expectedRevision: 'old' })).toMatchObject({ error: { code: 'stale_revision' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		bridge.dispose();
	});

	it('uses the current editor scope for every named block operation', async () => {
		const view = setup();
		const child = createMockCodeBlock({
			projectPath: 'audio',
			name: 'counter',
			blockType: 'module',
			code: ['module counter', 'int value 9', 'moduleEnd'],
		});
		const note = createMockCodeBlock({
			projectPath: 'audio',
			name: 'counter',
			blockType: 'note',
			code: ['note counter', 'colors', 'noteEnd'],
		});
		const group = createMockCodeBlock({
			projectPath: '',
			name: 'audio',
			code: ['group audio', 'groupEnd'],
			nestedProjectCodeBlocks: [child, note],
		});
		view.snapshot.blocks.push(
			{ blockId: 'audio', block: group },
			{ blockId: 'child', block: child },
			{ blockId: 'note', block: note },
			{
				blockId: 'root-only',
				block: createMockCodeBlock({
					projectPath: '',
					name: 'rootOnly',
					blockType: 'module',
					code: ['module rootOnly', 'moduleEnd'],
				}),
			}
		);
		view.navigation.openGroup.mockImplementation(() => {
			view.snapshot.projectPath = 'audio';
		});
		view.navigation.goToParentGroup.mockImplementation(() => {
			view.snapshot.projectPath = '';
		});
		view.navigation.goToRoot.mockImplementation(() => {
			view.snapshot.projectPath = '';
		});
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		const call = (name: string, args = {}) => view.tools.get(name)!.execute(args);
		expect(await call('expand_group', { name: 'audio' })).toEqual({
			projectPath: 'audio',
			revision: view.snapshot.revision,
		});
		expect(view.navigation.openGroup).toHaveBeenCalledWith('audio');
		expect(await call('get_project')).toMatchObject({
			code: expect.stringContaining('int value 9'),
			revision: view.snapshot.revision,
		});
		expect(await call('get_project')).not.toMatchObject({ code: expect.stringContaining('rootOnly') });
		expect(await call('get_project', { name: 'audio' })).toMatchObject({ error: { code: 'invalid_request' } });
		expect(await call('get_block', { type: 'module', name: 'counter' })).toBe(child.code.join('\n'));
		expect(await call('get_block', { type: 'note', name: 'counter' })).toBe(note.code.join('\n'));
		await call('update_block', {
			type: 'module',
			name: 'counter',
			expectedRevision: view.snapshot.revision,
			code: 'module counter\nmoduleEnd',
		});
		expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
			expectedRevision: view.snapshot.revision,
			edits: [{ type: 'update', blockId: 'child', code: ['module counter', 'moduleEnd'] }],
		});
		await call('patch_block', {
			type: 'module',
			name: 'counter',
			expectedRevision: view.snapshot.revision,
			oldText: 'int value 9',
			newText: 'int value 10',
		});
		expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
			expectedRevision: view.snapshot.revision,
			edits: [{ type: 'update', blockId: 'child', code: ['module counter', 'int value 10', 'moduleEnd'] }],
		});
		await call('apply_edits', {
			expectedRevision: view.snapshot.revision,
			edits: [
				{ operation: 'delete', type: 'note', name: 'counter' },
				{ operation: 'insert', code: 'note colors\nnoteEnd' },
			],
		});
		expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
			expectedRevision: view.snapshot.revision,
			edits: [
				{ type: 'delete', blockId: 'note' },
				{ type: 'insert', projectPath: 'audio', code: ['note colors', 'noteEnd'] },
			],
		});
		for (const tool of ['get_block', 'get_block_metadata', 'update_block', 'patch_block']) {
			expect(
				await call(tool, {
					type: 'module',
					name: 'rootOnly',
					...(tool === 'update_block' ? { code: '', expectedRevision: view.snapshot.revision } : {}),
					...(tool === 'patch_block'
						? { oldText: 'int value 9', newText: 'int value 10', expectedRevision: view.snapshot.revision }
						: {}),
				})
			).toMatchObject({ error: { code: 'block_not_found' } });
		}
		vi.mocked(view.editing.applyEdits).mockClear();
		expect(
			await call('apply_edits', {
				expectedRevision: view.snapshot.revision,
				edits: [
					{ operation: 'update', type: 'module', name: 'counter', code: child.code.join('\n') },
					{ operation: 'delete', type: 'module', name: 'rootOnly' },
				],
			})
		).toMatchObject({ error: { code: 'block_not_found' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		view.snapshot.blocks.push({ blockId: 'duplicate', block: structuredClone(child) });
		for (const tool of ['get_block', 'get_block_metadata', 'update_block', 'patch_block']) {
			expect(
				await call(tool, {
					type: 'module',
					name: 'counter',
					...(tool === 'update_block' ? { code: '', expectedRevision: view.snapshot.revision } : {}),
					...(tool === 'patch_block'
						? { oldText: 'int value 9', newText: 'int value 10', expectedRevision: view.snapshot.revision }
						: {}),
				})
			).toMatchObject({ error: { code: 'ambiguous_block' } });
		}
		expect(
			await call('apply_edits', {
				expectedRevision: view.snapshot.revision,
				edits: [{ operation: 'delete', type: 'module', name: 'counter' }],
			})
		).toMatchObject({ error: { code: 'ambiguous_block' } });
		expect(
			await call('update_block', { type: 'module', name: 'counter', expectedRevision: 'old', code: '' })
		).toMatchObject({ error: { code: 'stale_revision' } });
		expect(await call('go_to_parent')).toMatchObject({ projectPath: '' });
		view.snapshot.projectPath = 'audio';
		expect(await call('go_to_root')).toMatchObject({ projectPath: '' });
		bridge.dispose();
	});

	it('rejects identifiers, separate coordinates, and invalid edit shapes before changing anything', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		const code = 'module counter\n; @pos -20 30\nmoduleEnd';
		for (const edits of [
			[],
			[{ operation: 'insert', code, x: 1 }],
			[{ operation: 'insert', code, y: 2 }],
			[{ operation: 'insert', code, projectPath: '' }],
			[{ operation: 'update', type: 'module', name: 'counter', code: ['old array format'] }],
			[{ operation: 'update', type: 'module', name: 'counter', code, blockId: 'counter-handle' }],
			[{ operation: 'delete', blockId: 'counter-handle' }],
			[{ operation: 'move', type: 'module', name: 'counter', x: 1, y: 2 }],
		]) {
			expect(
				await view.tools.get('apply_edits')!.execute({ expectedRevision: view.snapshot.revision, edits })
			).toMatchObject({ error: { code: 'invalid_request' } });
		}
		expect(await view.tools.get('get_block_metadata')!.execute({ blockId: 'counter-handle' })).toMatchObject({
			error: { code: 'invalid_request' },
		});
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		bridge.dispose();
	});

	it('rejects a second bridge and prevents retained tools from reaching a replacement editor', async () => {
		const view = setup();
		const first = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await first.ready;
		const retained = view.tools.get('apply_edits')!;
		expect(() =>
			createEditorWebMcp({ document: view.document, editor: { editing: view.editing, navigation: view.navigation } })
		).toThrow('Only one');
		first.dispose();
		first.dispose();
		const second = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await second.ready;
		expect(await retained.execute({ expectedRevision: 'editor-one:1', edits: [] })).toMatchObject({
			error: { code: 'disposed' },
		});
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		expect(view.tools.size).toBe(12);
		second.dispose();
	});

	it('returns structured errors and rejects cancelled calls or editor routing arguments', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		const controller = new AbortController();
		controller.abort();
		expect(
			await view.tools.get('undo')!.execute({ expectedRevision: 'editor-one:1' }, { signal: controller.signal })
		).toMatchObject({ error: { code: 'cancelled' } });
		expect(
			await view.tools.get('undo')!.execute({ expectedRevision: 'editor-one:1', editorId: 'other' })
		).toMatchObject({ error: { code: 'invalid_request' } });
		vi.mocked(view.editing.undo).mockImplementation(() => {
			throw Object.assign(new Error('Outdated project'), { code: 'stale_revision', revision: 'editor-two:1' });
		});
		expect(await view.tools.get('undo')!.execute({ expectedRevision: 'editor-one:1' })).toEqual({
			error: { code: 'stale_revision', message: 'Outdated project', revision: 'editor-two:1' },
		});
		bridge.dispose();
	});

	it('cleans up partial registrations on failure and supports disposal during registration', async () => {
		const view = setup();
		view.registerTool.mockImplementationOnce(view.registerTool.getMockImplementation()!).mockImplementationOnce(() => {
			throw new Error('Browser denied registration');
		});
		const failed = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await expect(failed.ready).rejects.toThrow('denied registration');
		expect(view.tools.size).toBe(0);
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		bridge.dispose();
		await bridge.ready;
		expect(view.tools.size).toBe(0);
	});

	it('leaves unsupported browsers operational', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: {} as Document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		expect(bridge.supported).toBe(false);
		await bridge.ready;
		bridge.dispose();
		expect(view.editing.getSnapshot).not.toHaveBeenCalled();
	});
});
