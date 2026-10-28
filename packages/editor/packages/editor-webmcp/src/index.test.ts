import type { EditorEditingHandle, EditorProjectSnapshot } from '@8f4e/editor-core';
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
	const snapshot = { revision: 'editor-one:1', compilerInputRevision: 1 } as EditorProjectSnapshot;
	const editing: EditorEditingHandle = {
		getSnapshot: vi.fn(() => snapshot),
		applyEdits: vi.fn(() => ({ revision: 'editor-one:2', createdBlockIds: [] })),
		undo: vi.fn(() => ({ revision: 'editor-one:3', createdBlockIds: [] })),
		redo: vi.fn(() => ({ revision: 'editor-one:4', createdBlockIds: [] })),
	};
	return { tools, registerTool, document, editing, snapshot };
}

describe('single-editor WebMCP bridge', () => {
	it('delegates to the supplied editing handle and returns revisioned compiler diagnostics', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({
			document: view.document,
			editor: { editing: view.editing },
			getDiagnostics: () => ({ status: 'pending', completedRevision: null }),
		});
		await bridge.ready;
		expect([...view.tools.keys()]).toEqual(['get_project', 'apply_edits', 'undo', 'redo', 'get_diagnostics']);
		expect(await view.tools.get('get_project')!.execute({})).toBe(view.snapshot);
		const edits = [{ type: 'insert', code: ['module new', 'moduleEnd'] }];
		await view.tools.get('apply_edits')!.execute({ expectedRevision: 'editor-one:1', edits });
		expect(view.editing.applyEdits).toHaveBeenCalledWith({ expectedRevision: 'editor-one:1', edits });
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

	it('rejects a second bridge and prevents retained tools from reaching a replacement editor', async () => {
		const view = setup();
		const first = createEditorWebMcp({ document: view.document, editor: { editing: view.editing } });
		await first.ready;
		const retained = view.tools.get('apply_edits')!;
		expect(() => createEditorWebMcp({ document: view.document, editor: { editing: view.editing } })).toThrow(
			'Only one'
		);
		first.dispose();
		first.dispose();
		const second = createEditorWebMcp({ document: view.document, editor: { editing: view.editing } });
		await second.ready;
		expect(await retained.execute({ expectedRevision: 'editor-one:1', edits: [] })).toMatchObject({
			error: { code: 'disposed' },
		});
		expect(view.editing.applyEdits).not.toHaveBeenCalled();
		expect(view.tools.size).toBe(4);
		second.dispose();
	});

	it('returns structured errors and rejects cancelled calls or editor routing arguments', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({ document: view.document, editor: { editing: view.editing } });
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
		const failed = createEditorWebMcp({ document: view.document, editor: { editing: view.editing } });
		await expect(failed.ready).rejects.toThrow('denied registration');
		expect(view.tools.size).toBe(0);
		const bridge = createEditorWebMcp({ document: view.document, editor: { editing: view.editing } });
		bridge.dispose();
		await bridge.ready;
		expect(view.tools.size).toBe(0);
	});

	it('leaves unsupported browsers operational', async () => {
		const view = setup();
		const bridge = createEditorWebMcp({ document: {} as Document, editor: { editing: view.editing } });
		expect(bridge.supported).toBe(false);
		await bridge.ready;
		bridge.dispose();
		expect(view.editing.getSnapshot).not.toHaveBeenCalled();
	});
});
