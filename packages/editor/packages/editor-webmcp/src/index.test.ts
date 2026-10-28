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
	it('returns metadata on demand while leaving the editor snapshot complete', async () => {
		const view = setup();
		const before = structuredClone(view.snapshot);
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
		});
		await bridge.ready;
		expect(await view.tools.get('get_block_metadata')!.execute({ blockId: 'counter-handle' })).toEqual({
			revision: 'editor-one:1',
			block: {
				blockId: 'counter-handle',
				projectPath: '',
				type: 'module',
				name: 'counter',
				x: 10,
				y: 20,
				entry: 'main',
			},
		});
		expect(await view.tools.get('get_block_metadata')!.execute({ blockId: 'missing' })).toMatchObject({
			error: { code: 'block_not_found' },
		});
		expect(
			await view.tools.get('apply_edits')!.execute({
				expectedRevision: 'editor-one:1',
				edits: [{ type: 'update', blockId: 'counter-handle', code: ['old array format'] }],
			})
		).toMatchObject({ error: { code: 'invalid_request' } });
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		expect(view.snapshot).toEqual(before);
		bridge.dispose();
	});
	it('delegates to the supplied editing handle and returns revisioned compiler diagnostics', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing, navigation: view.navigation },
			getDiagnostics: () => ({ status: 'pending', completedRevision: null }),
		});
		await bridge.ready;
		expect([...view.tools.keys()]).toEqual([
			'get_project',
			'expand_group',
			'go_to_parent',
			'go_to_root',
			'get_block',
			'update_block',
			'get_block_metadata',
			'apply_edits',
			'undo',
			'redo',
			'get_diagnostics',
		]);
		expect(await view.tools.get('get_project')!.execute({})).toEqual({
			revision: 'editor-one:1',
			editable: true,
			canUndo: false,
			canRedo: false,
			code: '8f4e/v1\n\nentry main\n\n' + view.snapshot.blocks[0].block.code.join('\n') + '\nentryEnd',
			projectPath: '',
			blocks: [{ blockId: 'counter-handle', startLine: 5, endLine: 8 }],
		});
		expect(view.snapshot.project.modules[0].code).toEqual(view.snapshot.blocks[0].block.code);
		const edits = [{ type: 'insert', code: 'module new\n\n\tpush 1\r\nmoduleEnd\n' }];
		await view.tools.get('apply_edits')!.execute({ expectedRevision: 'editor-one:1', edits });
		expect(view.editing.applyEdits).toHaveBeenCalledWith({
			expectedRevision: 'editor-one:1',
			edits: [{ type: 'insert', projectPath: '', code: ['module new', '', '\tpush 1', 'moduleEnd', ''] }],
		});
		expect(await view.tools.get('get_diagnostics')!.execute({})).toEqual({
			revision: 'editor-one:1',
			compilerInputRevision: 1,
			diagnostics: { status: 'pending', completedRevision: null },
		});
		expect(view.tools.get('get_project')!.annotations.readOnlyHint).toBe(true);
		expect(view.tools.get('apply_edits')!.annotations.readOnlyHint).toBe(false);
		bridge.dispose();
		expect(view.tools.size).toBe(0);
	});

	it('shares the current editor scope for navigation, named reads, updates, and batches', async () => {
		const view = setup();
		const child = createMockCodeBlock({
			projectPath: 'audio',
			name: 'counter',
			blockType: 'module',
			code: ['module counter', 'int value 9', 'moduleEnd'],
		});
		const group = createMockCodeBlock({
			projectPath: '',
			name: 'audio',
			code: ['group audio', 'groupEnd'],
			nestedProjectCodeBlocks: [child],
		});
		view.snapshot.blocks.push({ blockId: 'audio', block: group }, { blockId: 'child', block: child });
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
		expect(await call('get_block', { type: 'module', name: 'counter' })).toMatchObject({
			code: view.snapshot.blocks[0].block.code.join('\n'),
		});
		expect(await call('expand_group', { name: 'audio' })).toEqual({
			projectPath: 'audio',
			revision: view.snapshot.revision,
		});
		expect(view.navigation.openGroup).toHaveBeenCalledWith('audio');
		expect(await call('get_project')).toMatchObject({
			projectPath: 'audio',
			blocks: [{ blockId: 'child', startLine: 3, endLine: 5 }],
		});
		expect(await call('get_project', { name: 'audio' })).toMatchObject({ error: { code: 'invalid_request' } });
		expect(await call('get_block', { type: 'module', name: 'counter' })).toMatchObject({ code: child.code.join('\n') });
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
		for (const type of ['update', 'move', 'delete']) {
			expect(
				await call('apply_edits', {
					expectedRevision: view.snapshot.revision,
					edits: [{ type, blockId: 'counter-handle', code: 'module counter\nmoduleEnd', x: 1, y: 2 }],
				})
			).toMatchObject({ error: { code: 'block_not_found' } });
		}
		expect(await call('get_block_metadata', { blockId: 'counter-handle' })).toMatchObject({
			error: { code: 'block_not_found' },
		});
		expect(
			await call('apply_edits', {
				expectedRevision: view.snapshot.revision,
				edits: [{ type: 'insert', projectPath: '', code: 'note\nnoteEnd' }],
			})
		).toMatchObject({ error: { code: 'invalid_request' } });
		await call('apply_edits', {
			expectedRevision: view.snapshot.revision,
			edits: [{ type: 'insert', code: 'note\nnoteEnd' }],
		});
		expect(view.editing.applyEdits).toHaveBeenLastCalledWith({
			expectedRevision: view.snapshot.revision,
			edits: [{ type: 'insert', projectPath: 'audio', code: ['note', 'noteEnd'] }],
		});
		expect(await call('expand_group', { name: 'audio' })).toMatchObject({ error: { code: 'block_not_found' } });
		expect(await call('get_block', { type: 'function', name: 'counter' })).toMatchObject({
			error: { code: 'block_not_found' },
		});
		view.snapshot.blocks.push({ blockId: 'duplicate', block: structuredClone(child) });
		expect(await call('get_block', { type: 'module', name: 'counter' })).toMatchObject({
			error: { code: 'ambiguous_block' },
		});
		expect(
			await call('update_block', { type: 'module', name: 'counter', expectedRevision: 'outdated', code: '' })
		).toMatchObject({ error: { code: 'stale_revision' } });
		expect(await call('go_to_parent')).toMatchObject({ projectPath: '' });
		view.snapshot.projectPath = 'audio'; // A human can also change the shared editor location.
		expect(await call('go_to_root')).toMatchObject({ projectPath: '' });
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
		expect(view.tools.size).toBe(10);
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
