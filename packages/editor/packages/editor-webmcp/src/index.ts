import type { Editor, EditorEdit, EditorProjectSnapshot } from '@8f4e/editor-core';
import { editsSchema, emptySchema, metadataSchema, revisionSchema } from './schema.js';

export type WebMcpProjectSnapshot = Pick<EditorProjectSnapshot, 'revision' | 'editable' | 'canUndo' | 'canRedo'> & {
	blocks: Array<{ blockId: string; code: string }>;
};

function readEdits(input: unknown): EditorEdit[] {
	if (!Array.isArray(input)) throw new Error('edits must be an array');
	return input.map(value => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid edit');
		const edit = value as Record<string, unknown>;
		if (edit.type === 'insert' || edit.type === 'update') {
			if (typeof edit.code !== 'string') throw new Error('code must be a source string');
			return { ...edit, code: edit.code.split(/\r\n|\n|\r/) } as EditorEdit;
		}
		return edit as EditorEdit;
	});
}

/** Structural types keep the experimental browser API out of editor-core and global DOM typings. */
export interface WebMcpTool {
	name: string;
	title: string;
	description: string;
	inputSchema: object;
	annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
	execute(input: unknown, options?: { signal: AbortSignal }): Promise<unknown>;
}

export interface WebMcpModelContext {
	registerTool(tool: WebMcpTool, options: { signal: AbortSignal }): void | Promise<void>;
}

export interface EditorWebMcpBridge {
	supported: boolean;
	/** Resolves after all tools are registered. Rejects on registration failure after removing partial registrations. */
	ready: Promise<void>;
	dispose(): void;
}

const activeDocuments = new WeakSet<Document>();

export function createEditorWebMcp({
	document,
	editor,
	getDiagnostics,
}: {
	document: Document;
	editor: Pick<Editor, 'editing'>;
	getDiagnostics?: () => unknown;
}): EditorWebMcpBridge {
	if (!editor?.editing) throw new Error('A single editor with an editing handle is required');
	const context = (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
	if (typeof context?.registerTool !== 'function') {
		return { supported: false, ready: Promise.resolve(), dispose() {} };
	}
	if (activeDocuments.has(document)) throw new Error('Only one 8f4e WebMCP bridge may be active per document');
	activeDocuments.add(document);
	const controller = new AbortController();
	const editing = editor.editing;
	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		controller.abort();
		activeDocuments.delete(document);
	};
	const failure = (code: string, message: string) => ({ error: { code, message } });
	const request = (input: unknown, fields: string[]): Record<string, unknown> => {
		if (
			!input ||
			typeof input !== 'object' ||
			Array.isArray(input) ||
			Object.keys(input).some(key => !fields.includes(key))
		) {
			throw new Error('Invalid tool arguments');
		}
		return input as Record<string, unknown>;
	};
	const writeRequest = (input: unknown, fields: string[]) => {
		const args = request(input, fields);
		if (typeof args.expectedRevision !== 'string') throw new Error('expectedRevision from get_project is required');
		return { ...args, expectedRevision: args.expectedRevision };
	};
	const tool = (
		name: string,
		title: string,
		description: string,
		schema: object,
		readOnly: boolean,
		run: (input: unknown) => unknown
	): WebMcpTool => ({
		name,
		title,
		description,
		inputSchema: schema,
		annotations: { readOnlyHint: readOnly, untrustedContentHint: true },
		async execute(input, options) {
			if (disposed)
				return failure('disposed', 'This bridge has been disposed; read the newly opened project before editing');
			if (options?.signal.aborted) return failure('cancelled', 'Tool execution was cancelled');
			try {
				return run(input);
			} catch (error) {
				if (error instanceof Error) {
					const details = error as Error & { code?: string; revision?: string };
					return {
						error: {
							code: details.code ?? 'invalid_request',
							message: details.message,
							...(details.revision ? { revision: details.revision } : {}),
						},
					};
				}
				return failure('invalid_request', String(error));
			}
		},
	});
	const tools = [
		tool(
			'get_project',
			'Read the open 8f4e project',
			'Read source strings and block handles for the bound editor, with its opaque revision and editing/history availability. Use get_block_metadata when scope, entry, or layout details are needed. Read again after editing or opening another project.',
			emptySchema,
			true,
			input => {
				request(input, []);
				const snapshot = editing.getSnapshot();
				return {
					revision: snapshot.revision,
					editable: snapshot.editable,
					canUndo: snapshot.canUndo,
					canRedo: snapshot.canRedo,
					blocks: snapshot.blocks.map(block => ({ blockId: block.blockId, code: block.code.join('\n') })),
				} satisfies WebMcpProjectSnapshot;
			}
		),
		tool(
			'get_block_metadata',
			'Read 8f4e block metadata',
			"Read a current block's project group path, execution entry, type, name, and grid position. Source is provided by get_project. The result includes the current revision.",
			metadataSchema,
			true,
			input => {
				const args = request(input, ['blockId']);
				if (typeof args.blockId !== 'string') throw new Error('blockId from get_project is required');
				const snapshot = editing.getSnapshot();
				const block = snapshot.blocks.find(block => block.blockId === args.blockId);
				if (!block)
					return {
						error: {
							code: 'block_not_found',
							message: 'Read get_project for a current blockId',
							revision: snapshot.revision,
						},
					};
				const { code: _code, ...metadata } = block;
				return { revision: snapshot.revision, block: metadata };
			}
		),
		tool(
			'apply_edits',
			'Edit the open 8f4e project',
			'Apply one atomic undoable batch of insert, update, move, or delete operations. Insert/update code is a complete source string. Requires the latest get_project revision. Positions are grid coordinates; insert defaults to the root project and entry main. Compilation errors are reported separately.',
			editsSchema,
			false,
			input => {
				const args = writeRequest(input, ['expectedRevision', 'edits']);
				return editing.applyEdits({
					expectedRevision: args.expectedRevision,
					edits: readEdits('edits' in args ? args.edits : undefined),
				});
			}
		),
		...(['undo', 'redo'] as const).map(action =>
			tool(
				action,
				`${action === 'undo' ? 'Undo' : 'Redo'} an 8f4e edit`,
				`${action === 'undo' ? 'Undo' : 'Redo'} one history step in the bound editor. Requires the latest get_project revision.`,
				revisionSchema,
				false,
				input => editing[action](writeRequest(input, ['expectedRevision']))
			)
		),
	];
	if (getDiagnostics)
		tools.push(
			tool(
				'get_diagnostics',
				'Read 8f4e diagnostics',
				'Read compiler and editor diagnostics for the bound project. pending or compiling results are not final; completedRevision identifies the compiler input that produced the errors.',
				emptySchema,
				true,
				input => {
					request(input, []);
					const snapshot = editing.getSnapshot();
					return {
						revision: snapshot.revision,
						compilerInputRevision: snapshot.compilerInputRevision,
						diagnostics: getDiagnostics(),
					};
				}
			)
		);
	const ready = (async () => {
		try {
			for (const definition of tools) {
				if (disposed) return;
				await context.registerTool(definition, { signal: controller.signal });
			}
		} catch (error) {
			const wasDisposed = disposed;
			dispose();
			if (!wasDisposed) throw error;
		}
	})();
	return { supported: true, ready, dispose };
}
