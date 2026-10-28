import { type CodeBlockGraphicData, type Editor, type EditorEdit, getEditorBlockId } from '@8f4e/editor-core';
import { blockSchema, editsSchema, emptySchema, groupSchema, patchBlockSchema, updateBlockSchema } from './schema.js';
import { createSourceView, getCurrentProjectPath } from './source-view.js';

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
const sourceChangedMessage =
	'The project changed since your last source fetch or successful edit. Re-fetch with get_project or get_block before writing.';

export function createEditorWebMcp({
	document,
	editor,
	getCompilerDiagnostics,
}: {
	document: Document;
	editor: Pick<Editor, 'editing' | 'navigation' | 'state'>;
	getCompilerDiagnostics?: () => unknown;
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
	const state = editor.state;
	let disposed = false;
	let observedRevision: string | undefined;
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
					const details = error as Error & { code?: string };
					return {
						error: {
							code: details.code ?? 'invalid_request',
							message: details.code === 'stale_revision' ? sourceChangedMessage : details.message,
						},
					};
				}
				return failure('invalid_request', String(error));
			}
		},
	});
	const blockType = (block: CodeBlockGraphicData) =>
		block.nestedProjectCodeBlocks !== undefined ? 'group' : block.isProjectScope ? 'project' : block.blockType;
	const toolError = (code: string, message: string): never => {
		throw Object.assign(new Error(message), { code });
	};
	const namedBlock = (type: unknown, name: unknown) => {
		if (typeof type !== 'string' || typeof name !== 'string') throw new Error('Block type and name are required');
		const matches = state.codeBlockRendering.codeBlocks.filter(
			block => blockType(block) === type && block.name === name
		);
		if (matches.length === 0)
			return toolError('block_not_found', 'No matching block in the currently expanded group or root');
		if (matches.length > 1)
			return toolError(
				'ambiguous_block',
				'Multiple blocks have this type and name in the current scope; give them unique source names before targeting one'
			);
		return matches[0];
	};
	const readEdits = (input: unknown): EditorEdit[] => {
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
			const target = operation === 'insert' ? undefined : namedBlock(args.type, args.name);
			if (operation === 'delete') return { type: 'delete', blockId: getEditorBlockId(target!) };
			if (typeof args.code !== 'string') throw new Error('code must be a source string');
			const source = {
				code: args.code.split(/\r\n|\n|\r/),
				...('entry' in args ? { entry: args.entry as string } : {}),
			};
			return operation === 'insert'
				? { type: 'insert', projectPath: getCurrentProjectPath(state), ...source }
				: { type: 'update', blockId: getEditorBlockId(target!), ...source };
		});
	};
	const checkRevision = (revision: string) => {
		if (observedRevision === undefined)
			toolError('source_required', 'Fetch source with get_project or get_block before writing.');
		if (observedRevision !== revision) toolError('stale_revision', sourceChangedMessage);
	};
	const applyEdits = (revision: string, edits: EditorEdit[], message: string) => {
		const result = editing.applyEdits({ expectedRevision: revision, edits });
		// Record the actual result token: one edit can advance the editor revision several times.
		observedRevision = result.revision;
		return message;
	};
	const location = () => {
		return { projectPath: getCurrentProjectPath(state), revision: editing.getRevision() };
	};
	const tools = [
		tool(
			'get_project',
			'Read the open 8f4e project',
			'Return only the currently expanded group or root as one 8f4e source string. A successful source fetch refreshes the bridge revision baseline for writes. Child groups are shown as declarations without their contents. Navigate with expand_group, go_to_parent, or go_to_root, then read again. Location and history information are available through get_project_metadata; metadata reads do not refresh the write baseline.',
			emptySchema,
			true,
			input => {
				request(input, []);
				const revision = editing.getRevision();
				const source = createSourceView(state);
				observedRevision = revision;
				return source;
			}
		),
		tool(
			'get_project_metadata',
			'Read 8f4e project metadata',
			'Read the current revision, location, editability, and undo/redo availability without source or block identifiers. This does not acknowledge source changes or refresh the bridge revision baseline; fetch source with get_project or get_block before writing.',
			emptySchema,
			true,
			input => {
				request(input, []);
				return {
					revision: editing.getRevision(),
					projectPath: getCurrentProjectPath(state),
					editable: Boolean(state.featureFlags.editing),
					canUndo: state.historyStack.length > 0,
					canRedo: state.redoStack.length > 0,
				};
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
				const target = namedBlock('group', args.name);
				navigation.openGroup(getEditorBlockId(target));
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
			'Read a block by its type and name only within the currently expanded group or root. Returns its source as a string and refreshes the bridge revision baseline for writes. Duplicate matches produce an ambiguous_block error.',
			blockSchema,
			true,
			input => {
				const args = request(input, ['type', 'name']);
				const revision = editing.getRevision();
				const target = namedBlock(args.type, args.name);
				const source = target.code.join('\n');
				observedRevision = revision;
				return source;
			}
		),
		tool(
			'update_block',
			'Update an 8f4e block',
			'Replace the source of a block identified by type and name only within the currently expanded group or root. Requires a prior source fetch and creates one undo step. External changes block writes until source is fetched again; consecutive bridge edits work without re-fetching.',
			updateBlockSchema,
			false,
			input => {
				const args = request(input, ['type', 'name', 'code']);
				const revision = editing.getRevision();
				checkRevision(revision);
				return applyEdits(
					revision,
					readEdits([{ operation: 'update', type: args.type, name: args.name, code: args.code }]),
					'Block updated.'
				);
			}
		),
		tool(
			'patch_block',
			'Patch an 8f4e block',
			'Replace one exact occurrence of oldText with literal newText in a block identified by type and name in the currently expanded group or root. Text may span multiple lines; line endings are normalized to LF. Empty or missing matches and multiple matches are rejected. Requires a prior source fetch and creates one undo step. External changes require source to be fetched again; successful bridge edits advance the baseline automatically.',
			patchBlockSchema,
			false,
			input => {
				const args = request(input, ['type', 'name', 'oldText', 'newText']);
				const revision = editing.getRevision();
				checkRevision(revision);
				if (typeof args.oldText !== 'string' || args.oldText.length === 0 || typeof args.newText !== 'string')
					throw new Error('oldText must be a nonempty string and newText must be a string');
				const target = namedBlock(args.type, args.name);
				const source = target.code.join('\n');
				const oldText = args.oldText.replace(/\r\n|\r/g, '\n');
				const newText = args.newText.replace(/\r\n|\r/g, '\n');
				const start = source.indexOf(oldText);
				if (start === -1)
					return toolError('match_not_found', 'oldText does not occur in this block; read its source again');
				if (source.indexOf(oldText, start + 1) !== -1)
					return toolError(
						'ambiguous_match',
						'oldText occurs more than once; include more surrounding source to identify one match'
					);
				// Slice explicitly so replacement text such as $& is always literal.
				const code = source.slice(0, start) + newText + source.slice(start + oldText.length);
				return applyEdits(
					revision,
					[{ type: 'update', blockId: getEditorBlockId(target), code: code.split('\n') }],
					'Block patched.'
				);
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
				const revision = editing.getRevision();
				const block = namedBlock(args.type, args.name);
				return {
					revision,
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
			'Apply one atomic undoable batch within the currently expanded group or root. Insert/update code is a complete source string. Requires a prior source fetch; the bridge tracks revisions and rejects writes after external changes until source is fetched again. Update/delete operations identify blocks by type and name in the current scope. Inserts use the current group and default to entry main. Set or change positions through the @pos directive in source code.',
			editsSchema,
			false,
			input => {
				const args = request(input, ['edits']);
				const revision = editing.getRevision();
				checkRevision(revision);
				return applyEdits(revision, readEdits(args.edits), 'Edits applied.');
			}
		),
		...(['undo', 'redo'] as const).map(action =>
			tool(
				action,
				`${action === 'undo' ? 'Undo' : 'Redo'} an 8f4e edit`,
				`${action === 'undo' ? 'Undo' : 'Redo'} one history step in the bound editor. Requires a prior source fetch; the bridge tracks revisions and rejects writes after external changes until source is fetched again.`,
				emptySchema,
				false,
				input => {
					request(input, []);
					const revision = editing.getRevision();
					checkRevision(revision);
					const result = editing[action]({ expectedRevision: revision });
					observedRevision = result.revision;
					return action === 'undo' ? 'Undo complete.' : 'Redo complete.';
				}
			)
		),
	];
	if (getCompilerDiagnostics)
		tools.push(
			tool(
				'get_compiler_diagnostics',
				'Read 8f4e compiler diagnostics',
				'Read compiler and editor-directive diagnostics for the bound project. pending or compiling results are not final; completedRevision identifies the compiler input that produced the errors.',
				emptySchema,
				true,
				input => {
					request(input, []);
					const revision = editing.getRevision();
					return {
						revision,
						compilerInputRevision: state.compilerInputRevision,
						diagnostics: getCompilerDiagnostics(),
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
