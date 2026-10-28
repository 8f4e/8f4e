import type { Editor, EditorEdit, EditorProjectSnapshot } from '@8f4e/editor-core';
import { blockSchema, editsSchema, emptySchema, groupSchema, revisionSchema, updateBlockSchema } from './schema.js';
import { createSourceView } from './source-view.js';

export type WebMcpProjectMetadata = Pick<
	EditorProjectSnapshot,
	'revision' | 'projectPath' | 'editable' | 'canUndo' | 'canRedo'
>;

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
		if (typeof args.expectedRevision !== 'string')
			throw new Error('expectedRevision from get_project_metadata is required');
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
	const namedBlock = (snapshot: EditorProjectSnapshot, type: unknown, name: unknown) => {
		if (typeof type !== 'string' || typeof name !== 'string') throw new Error('Block type and name are required');
		const matches = scopedBlocks(snapshot).filter(target => blockType(target) === type && target.block.name === name);
		if (matches.length === 0)
			return scopeError(snapshot, 'block_not_found', 'No matching block in the currently expanded group or root');
		if (matches.length > 1)
			return scopeError(
				snapshot,
				'ambiguous_block',
				'Multiple blocks have this type and name in the current scope; give them unique source names before targeting one'
			);
		return matches[0];
	};
	const readEdits = (input: unknown, snapshot: EditorProjectSnapshot): EditorEdit[] => {
		if (!Array.isArray(input) || input.length === 0) throw new Error('Provide at least one edit');
		return input.map(value => {
			const operation = request(value, ['operation', 'type', 'name', 'code', 'entry']).operation;
			if (operation !== 'insert' && operation !== 'update' && operation !== 'delete')
				throw new Error('Use insert, update, or delete operations; position belongs in the @pos directive');
			const fields =
				operation === 'insert'
					? ['operation', 'code', 'entry']
					: operation === 'update'
						? ['operation', 'type', 'name', 'code', 'entry']
						: ['operation', 'type', 'name'];
			const args = request(value, fields);
			const target = operation === 'insert' ? undefined : namedBlock(snapshot, args.type, args.name);
			if (operation === 'delete') return { type: 'delete', blockId: target!.blockId };
			if (typeof args.code !== 'string') throw new Error('code must be a source string');
			const source = {
				code: args.code.split(/\r\n|\n|\r/),
				...('entry' in args ? { entry: args.entry as string } : {}),
			};
			return operation === 'insert'
				? { type: 'insert', projectPath: snapshot.projectPath, ...source }
				: { type: 'update', blockId: target!.blockId, ...source };
		});
	};
	const checkRevision = (snapshot: EditorProjectSnapshot, expectedRevision: string) => {
		if (expectedRevision !== snapshot.revision)
			scopeError(snapshot, 'stale_revision', 'Read get_project and get_project_metadata again before editing');
	};
	const location = () => {
		const { projectPath, revision } = editing.getSnapshot();
		return { projectPath, revision };
	};
	const tools = [
		tool(
			'get_project',
			'Read the open 8f4e project',
			'Return only the currently expanded group or root as a plain 8f4e source string. Child groups are shown as declarations without their contents. Navigate with expand_group, go_to_parent, or go_to_root, then read again. Revision and history information are available separately through get_project_metadata.',
			emptySchema,
			true,
			input => {
				request(input, []);
				return createSourceView(editing.getSnapshot());
			}
		),
		tool(
			'get_project_metadata',
			'Read 8f4e project metadata',
			'Read the current revision, location, editability, and undo/redo availability without source or block identifiers. Call this before reading source, then use its revision as expectedRevision for writes.',
			emptySchema,
			true,
			input => {
				request(input, []);
				const { revision, projectPath, editable, canUndo, canRedo } = editing.getSnapshot();
				return { revision, projectPath, editable, canUndo, canRedo } satisfies WebMcpProjectMetadata;
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
				return target.block.code.join('\n');
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
				const result = editing.applyEdits({
					expectedRevision: args.expectedRevision,
					edits: readEdits([{ operation: 'update', type: args.type, name: args.name, code: args.code }], snapshot),
				});
				return { revision: result.revision };
			}
		),
		tool(
			'get_block_metadata',
			'Read 8f4e block metadata',
			"Read a current block's project group path, execution entry, type, name, and grid position. Source is provided by get_project. The result includes the current revision.",
			blockSchema,
			true,
			input => {
				const args = request(input, ['type', 'name']);
				const snapshot = editing.getSnapshot();
				const target = namedBlock(snapshot, args.type, args.name);
				const { block } = target;
				return {
					revision: snapshot.revision,
					block: {
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
			'Apply one atomic undoable batch within the currently expanded group or root. Insert/update code is a complete source string. Requires the latest get_project_metadata revision. Update/delete operations identify blocks by type and name in the current scope. Inserts use the current group and default to entry main. Set or change positions through the @pos directive in source code.',
			editsSchema,
			false,
			input => {
				const args = writeRequest(input, ['expectedRevision', 'edits']);
				const snapshot = editing.getSnapshot();
				checkRevision(snapshot, args.expectedRevision);
				const result = editing.applyEdits({
					expectedRevision: args.expectedRevision,
					edits: readEdits(args.edits, snapshot),
				});
				return { revision: result.revision };
			}
		),
		...(['undo', 'redo'] as const).map(action =>
			tool(
				action,
				`${action === 'undo' ? 'Undo' : 'Redo'} an 8f4e edit`,
				`${action === 'undo' ? 'Undo' : 'Redo'} one history step in the bound editor. Requires the latest get_project_metadata revision.`,
				revisionSchema,
				false,
				input => ({ revision: editing[action](writeRequest(input, ['expectedRevision'])).revision })
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
