import { type CodeBlockGraphicData, type Editor, type EditorEdit, getEditorBlockId } from '@8f4e/editor-core';
import { createSourceView, getCurrentProjectPath } from './source-view.js';
import {
	emptyInput,
	objectArguments,
	objectInput,
	sourceChangedMessage,
	type ToolDefinition,
	toolError,
} from './tool.js';

const code = { type: 'string', description: 'Complete source of the block, with newline characters between lines.' };
const entry = { type: 'string', minLength: 1, pattern: '^\\S+$' };
const blockTypeInput = {
	type: 'string',
	enum: ['module', 'function', 'constants', 'prototype', 'includes', 'note', 'unknown', 'group', 'project'],
};
const blockInput = objectInput({ type: blockTypeInput, name: { type: 'string' } }, ['type', 'name']);
const editInputs = {
	insert: objectInput({ operation: { const: 'insert' }, code, entry }, ['operation', 'code']),
	update: objectInput({ operation: { const: 'update' }, type: blockTypeInput, name: { type: 'string' }, code, entry }, [
		'operation',
		'type',
		'name',
		'code',
	]),
	delete: objectInput({ operation: { const: 'delete' }, type: blockTypeInput, name: { type: 'string' } }, [
		'operation',
		'type',
		'name',
	]),
};
const editProperties = {
	...editInputs.insert.properties,
	...editInputs.update.properties,
	...editInputs.delete.properties,
};
const editsInput = objectInput({ edits: { type: 'array', minItems: 1, items: { oneOf: Object.values(editInputs) } } }, [
	'edits',
]);
const helpHint = ' If you are unfamiliar with 8f4e, start with get_help.';
const normalizeNewlines = (text: string) => text.replace(/\r\n|\r/g, '\n');
const blockType = (block: CodeBlockGraphicData) =>
	block.nestedProjectCodeBlocks !== undefined ? 'group' : block.isProjectScope ? 'project' : block.blockType;
export function createEditorTools(
	editor: Pick<Editor, 'editing' | 'navigation' | 'state'>,
	getCompilerDiagnostics?: () => unknown
): ToolDefinition[] {
	const { editing, navigation, state } = editor;
	let observedRevision: string | undefined;
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
			const operation = objectArguments(value, editProperties).operation;
			if (operation !== 'insert' && operation !== 'update' && operation !== 'delete')
				throw new Error('Use insert, update, or delete operations; position belongs in the @pos directive');
			const args = objectArguments(value, editInputs[operation].properties);
			const target = operation === 'insert' ? undefined : namedBlock(args.type, args.name);
			if (operation === 'delete') return { type: 'delete', blockId: getEditorBlockId(target!) };
			if (typeof args.code !== 'string') throw new Error('code must be a source string');
			const source = {
				code: normalizeNewlines(args.code).split('\n'),
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

	const tools: ToolDefinition[] = [
		{
			name: 'get_project',
			title: 'Read the open 8f4e project',
			description:
				'Return only the currently expanded group or root as one 8f4e source string. A successful source fetch refreshes the bridge revision baseline for writes. Child groups are shown as declarations without their contents. Navigate with expand_group, go_to_parent, or go_to_root, then read again. Location and history information are available through get_project_metadata; metadata reads do not refresh the write baseline.',
			inputSchema: emptyInput,
			readOnly: true,
			run: () => {
				const revision = editing.getRevision();
				const source = createSourceView(state);
				observedRevision = revision;
				return source;
			},
		},
		{
			name: 'get_project_metadata',
			title: 'Read 8f4e project metadata',
			description:
				'Read the current revision, location, editability, and undo/redo availability without source or block identifiers. This does not acknowledge source changes or refresh the bridge revision baseline; fetch source with get_project or get_block before writing.',
			inputSchema: emptyInput,
			readOnly: true,
			run: () => {
				return {
					revision: editing.getRevision(),
					projectPath: getCurrentProjectPath(state),
					editable: state.editorMode === 'edit',
					canUndo: state.historyStack.length > 0,
					canRedo: state.redoStack.length > 0,
				};
			},
		},
		{
			name: 'expand_group',
			title: 'Open a child 8f4e group',
			description:
				'Navigate the editor into a named child group of the currently expanded group or root. Returns the new location only; use get_project to read its source.' +
				helpHint,
			inputSchema: objectInput(
				{ name: { type: 'string', description: 'Name of a child group in the currently expanded group or root.' } },
				['name']
			),
			readOnly: false,
			run: args => {
				const target = namedBlock('group', args.name);
				navigation.openGroup(getEditorBlockId(target));
				return location();
			},
		},
		...(['go_to_parent', 'go_to_root'] as const).map(action => ({
			name: action,
			title: action === 'go_to_parent' ? 'Open the parent 8f4e group' : 'Open the 8f4e root',
			description:
				'Navigate the editor and return its location only. Use get_project to read the newly opened level.' + helpHint,
			inputSchema: emptyInput,
			readOnly: false,
			run: () => {
				if (action === 'go_to_parent') navigation.goToParentGroup();
				else navigation.goToRoot();
				return location();
			},
		})),
		{
			name: 'get_block',
			title: 'Read an 8f4e block',
			description:
				'Read a block by its type and name only within the currently expanded group or root. Returns its source as a string and refreshes the bridge revision baseline for writes. Duplicate matches produce an ambiguous_block error.',
			inputSchema: blockInput,
			readOnly: true,
			run: args => {
				const revision = editing.getRevision();
				const target = namedBlock(args.type, args.name);
				const source = target.code.join('\n');
				observedRevision = revision;
				return source;
			},
		},
		{
			name: 'update_block',
			title: 'Update an 8f4e block',
			description:
				'Replace the source of a block identified by type and name only within the currently expanded group or root. Requires a prior source fetch and creates one undo step. External changes block writes until source is fetched again; consecutive bridge edits work without re-fetching.' +
				helpHint,
			inputSchema: objectInput({ type: blockTypeInput, name: { type: 'string' }, code }, ['type', 'name', 'code']),
			readOnly: false,
			run: args => {
				const revision = editing.getRevision();
				checkRevision(revision);
				return applyEdits(
					revision,
					readEdits([{ operation: 'update', type: args.type, name: args.name, code: args.code }]),
					'Block updated.'
				);
			},
		},
		{
			name: 'patch_block',
			title: 'Patch an 8f4e block',
			description:
				'Replace one exact occurrence of oldText with literal newText in a block identified by type and name in the currently expanded group or root. Text may span multiple lines; line endings are normalized to LF. Empty or missing matches and multiple matches are rejected. Requires a prior source fetch and creates one undo step. External changes require source to be fetched again; successful bridge edits advance the baseline automatically.' +
				helpHint,
			inputSchema: objectInput(
				{
					type: blockTypeInput,
					name: { type: 'string' },
					oldText: {
						type: 'string',
						minLength: 1,
						description:
							'Exact source text to replace. Must occur exactly once in this block; include surrounding context if needed.',
					},
					newText: {
						type: 'string',
						description: 'Literal replacement text. May contain multiple lines or be empty to remove the match.',
					},
				},
				['type', 'name', 'oldText', 'newText']
			),
			readOnly: false,
			run: args => {
				const revision = editing.getRevision();
				checkRevision(revision);
				if (typeof args.oldText !== 'string' || args.oldText.length === 0 || typeof args.newText !== 'string')
					throw new Error('oldText must be a nonempty string and newText must be a string');
				const target = namedBlock(args.type, args.name);
				const source = target.code.join('\n');
				const oldText = normalizeNewlines(args.oldText);
				const newText = normalizeNewlines(args.newText);
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
			},
		},
		{
			name: 'get_block_metadata',
			title: 'Read 8f4e block metadata',
			description:
				"Read a current block's project group path, execution entry, type, name, and grid position. Source is provided by get_project. The result includes the current revision.",
			inputSchema: blockInput,
			readOnly: true,
			run: args => {
				const revision = editing.getRevision();
				const block = namedBlock(args.type, args.name);
				return {
					revision,
					block: {
						projectPath: block.projectPath,
						type: blockType(block),
						name: block.name,
						x: block.gridX,
						y: block.gridY,
						...(block.entry === undefined ? {} : { entry: block.entry }),
					},
				};
			},
		},
		{
			name: 'apply_edits',
			title: 'Edit the open 8f4e project',
			description:
				'Apply one atomic undoable batch within the currently expanded group or root. Insert/update code is a complete source string. Requires a prior source fetch; the bridge tracks revisions and rejects writes after external changes until source is fetched again. Update/delete operations identify blocks by type and name in the current scope. Inserts use the current group and default to entry main. Set or change positions through the @pos directive in source code.' +
				helpHint,
			inputSchema: editsInput,
			readOnly: false,
			run: args => {
				const revision = editing.getRevision();
				checkRevision(revision);
				return applyEdits(revision, readEdits(args.edits), 'Edits applied.');
			},
		},
		...(['undo', 'redo'] as const).map(action => ({
			name: action,
			title: `${action === 'undo' ? 'Undo' : 'Redo'} an 8f4e edit`,
			description:
				`${action === 'undo' ? 'Undo' : 'Redo'} one history step in the bound editor. Requires a prior source fetch; the bridge tracks revisions and rejects writes after external changes until source is fetched again.` +
				helpHint,
			inputSchema: emptyInput,
			readOnly: false,
			run: () => {
				const revision = editing.getRevision();
				checkRevision(revision);
				const result = editing[action]({ expectedRevision: revision });
				observedRevision = result.revision;
				return action === 'undo' ? 'Undo complete.' : 'Redo complete.';
			},
		})),
	];
	if (getCompilerDiagnostics)
		tools.push({
			name: 'get_compiler_diagnostics',
			title: 'Read 8f4e compiler diagnostics',
			description:
				'Read compiler and editor-directive diagnostics for the bound project. pending or compiling results are not final; completedRevision identifies the compiler input that produced the errors.',
			inputSchema: emptyInput,
			readOnly: true,
			run: () => {
				const revision = editing.getRevision();
				return {
					revision,
					compilerInputRevision: state.compilerInputRevision,
					diagnostics: getCompilerDiagnostics(),
				};
			},
		});
	return tools;
}
