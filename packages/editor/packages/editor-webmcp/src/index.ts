import type { Editor, EditorEdit, EditorProjectSnapshot } from '@8f4e/editor-core';
import {
	blockSchema,
	editsSchema,
	emptySchema,
	groupSchema,
	metadataSchema,
	revisionSchema,
	updateBlockSchema,
} from './schema.js';
import { createSourceView, type SourceView } from './source-view.js';

export type WebMcpProjectSnapshot = Pick<EditorProjectSnapshot, 'revision' | 'editable' | 'canUndo' | 'canRedo'> &
	SourceView;

function readEdits(input: unknown): EditorEdit[] {
	if (!Array.isArray(input)) throw new Error('edits must be an array');
	return input.map(value => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid edit');
		const edit = value as Record<string, unknown>;
		const fields =
			edit.type === 'insert'
				? ['type', 'code', 'projectPath', 'entry']
				: edit.type === 'update'
					? ['type', 'blockId', 'code', 'entry']
					: edit.type === 'delete'
						? ['type', 'blockId']
						: undefined;
		if (!fields || Object.keys(edit).some(key => !fields.includes(key)))
			throw new Error('Use insert, update, or delete with source code; position belongs in the @pos directive');
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
	editor: Pick<Editor, 'editing' | 'navigation'>;
	getDiagnostics?: () => unknown;
}): EditorWebMcpBridge {
	if (!editor?.editing || !editor.navigation)
		throw new Error('A single editor with editing and navigation handles is required');
	const context = (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
	if (typeof context?.registerTool !== 'function') {
		return { supported: false, ready: Promise.resolve(), dispose() {} };
	}
	if (activeDocuments.has(document)) throw new Error('Only one 8f4e WebMCP bridge may be active per document');
	activeDocuments.add(document);
	const controller = new AbortController();
	const editing = editor.editing;
	const navigation = editor.navigation;
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
	const writeRequest = (input: unknown, fields: string[]): Record<string, unknown> & { expectedRevision: string } => {
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
	const scopedBlocks = (snapshot: EditorProjectSnapshot) =>
		snapshot.blocks.filter(({ block }) => block.projectPath === snapshot.projectPath);
	const blockType = ({ block }: EditorProjectSnapshot['blocks'][number]) =>
		block.nestedProjectCodeBlocks !== undefined ? 'group' : block.isProjectScope ? 'project' : block.blockType;
	const scopeError = (snapshot: EditorProjectSnapshot, code: string, message: string): never => {
		throw Object.assign(new Error(message), { code, revision: snapshot.revision });
	};
	const currentBlock = (snapshot: EditorProjectSnapshot, id: unknown) => {
		const target = scopedBlocks(snapshot).find(block => block.blockId === id);
		if (!target)
			return scopeError(snapshot, 'block_not_found', 'The block must be in the currently expanded group or root');
		return target;
	};
	const namedBlock = (snapshot: EditorProjectSnapshot, type: unknown, name: unknown) => {
		if (typeof type !== 'string' || typeof name !== 'string') throw new Error('Block type and name are required');
		const matches = scopedBlocks(snapshot).filter(target => blockType(target) === type && target.block.name === name);
		if (matches.length === 0)
			return scopeError(snapshot, 'block_not_found', 'No matching block in the currently expanded group or root');
		if (matches.length > 1)
			return scopeError(
				snapshot,
				'ambiguous_block',
				'Multiple blocks have this type and name in the current scope; use source handles to disambiguate'
			);
		return matches[0];
	};
	const checkRevision = (snapshot: EditorProjectSnapshot, expectedRevision: string) => {
		if (expectedRevision !== snapshot.revision)
			scopeError(snapshot, 'stale_revision', 'Read get_project again before editing');
	};
	const location = () => {
		const { projectPath, revision } = editing.getSnapshot();
		return { projectPath, revision };
	};
	const tools = [
		tool(
			'get_project',
			'Read the open 8f4e project',
			'Read only the currently expanded group or root as one 8f4e code string. Child groups are shown as declarations without their contents. Navigate with expand_group, go_to_parent, or go_to_root, then read again. One-based inclusive source ranges identify editable blocks.',
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
					...createSourceView(snapshot),
				} satisfies WebMcpProjectSnapshot;
			}
		),
		tool(
			'expand_group',
			'Open a child 8f4e group',
			'Navigate the editor into a named child group of the currently expanded group or root. Returns the new location only; use get_project to read its source.',
			groupSchema,
			false,
			input => {
				const args = request(input, ['name']);
				const target = namedBlock(editing.getSnapshot(), 'group', args.name);
				navigation.openGroup(target.blockId);
				return location();
			}
		),
		...(['go_to_parent', 'go_to_root'] as const).map(action =>
			tool(
				action,
				action === 'go_to_parent' ? 'Open the parent 8f4e group' : 'Open the 8f4e root',
				'Navigate the editor and return its location only. Use get_project to read the newly opened level.',
				emptySchema,
				false,
				input => {
					request(input, []);
					if (action === 'go_to_parent') navigation.goToParentGroup();
					else navigation.goToRoot();
					return location();
				}
			)
		),
		tool(
			'get_block',
			'Read an 8f4e block',
			'Read a block by its type and name only within the currently expanded group or root. Returns its source as a string. Duplicate matches produce an ambiguous_block error.',
			blockSchema,
			true,
			input => {
				const args = request(input, ['type', 'name']);
				const snapshot = editing.getSnapshot();
				const target = namedBlock(snapshot, args.type, args.name);
				return { revision: snapshot.revision, projectPath: snapshot.projectPath, code: target.block.code.join('\n') };
			}
		),
		tool(
			'update_block',
			'Update an 8f4e block',
			'Replace the source of a block identified by type and name only within the currently expanded group or root. Requires the latest revision and creates one undo step.',
			updateBlockSchema,
			false,
			input => {
				const args = writeRequest(input, ['type', 'name', 'code', 'expectedRevision']);
				const snapshot = editing.getSnapshot();
				checkRevision(snapshot, args.expectedRevision);
				const target = namedBlock(snapshot, args.type, args.name);
				return editing.applyEdits({
					expectedRevision: args.expectedRevision,
					edits: readEdits([{ type: 'update', blockId: target.blockId, code: args.code }]),
				});
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
				const target = currentBlock(snapshot, args.blockId);
				const { blockId, block } = target;
				return {
					revision: snapshot.revision,
					block: {
						blockId,
						projectPath: block.projectPath,
						type: block.nestedProjectCodeBlocks ? 'group' : block.isProjectScope ? 'project' : block.blockType,
						name: block.name,
						x: block.gridX,
						y: block.gridY,
						...(block.entry === undefined ? {} : { entry: block.entry }),
					},
				};
			}
		),
		tool(
			'apply_edits',
			'Edit the open 8f4e project',
			'Apply one atomic undoable batch within the currently expanded group or root. Insert/update code is a complete source string. Requires the latest get_project revision. Inserts use the current group and default to entry main. Existing handles must belong to the current group. Set or change positions through the @pos directive in source code.',
			editsSchema,
			false,
			input => {
				const args = writeRequest(input, ['expectedRevision', 'edits']);
				const snapshot = editing.getSnapshot();
				checkRevision(snapshot, args.expectedRevision);
				const edits = readEdits(args.edits).map(edit => {
					if (edit.type === 'insert') {
						if (edit.projectPath !== undefined && edit.projectPath !== snapshot.projectPath)
							throw new Error('Inserts must target the currently expanded group or root');
						return { ...edit, projectPath: snapshot.projectPath };
					}
					currentBlock(snapshot, edit.blockId);
					return edit;
				});
				return editing.applyEdits({
					expectedRevision: args.expectedRevision,
					edits,
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
