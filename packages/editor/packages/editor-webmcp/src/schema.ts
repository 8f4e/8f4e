const code = { type: 'string', description: 'Complete source of the block, with newline characters between lines.' };
const entry = { type: 'string', minLength: 1, pattern: '^\\S+$' };

const object = (properties: Record<string, unknown>, required: string[]) => ({
	type: 'object',
	properties,
	required,
	additionalProperties: false,
});

export const emptySchema = object({}, []);
export const groupSchema = object(
	{ name: { type: 'string', description: 'Name of a child group in the currently expanded group or root.' } },
	['name']
);
const blockType = {
	type: 'string',
	enum: ['module', 'function', 'constants', 'prototype', 'includes', 'note', 'unknown', 'group', 'project'],
};
export const blockSchema = object({ type: blockType, name: { type: 'string' } }, ['type', 'name']);
export const updateBlockSchema = object(
	{ type: blockType, name: { type: 'string' }, code, expectedRevision: { type: 'string' } },
	['type', 'name', 'code', 'expectedRevision']
);
export const patchBlockSchema = object(
	{
		type: blockType,
		name: { type: 'string' },
		expectedRevision: { type: 'string' },
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
	['type', 'name', 'expectedRevision', 'oldText', 'newText']
);
export const revisionSchema = object({ expectedRevision: { type: 'string' } }, ['expectedRevision']);
export const editsSchema = object(
	{
		expectedRevision: {
			type: 'string',
			description: 'Revision from get_project_metadata or the last successful write.',
		},
		edits: {
			type: 'array',
			minItems: 1,
			items: {
				oneOf: [
					object({ operation: { const: 'insert' }, code, entry }, ['operation', 'code']),
					object({ operation: { const: 'update' }, type: blockType, name: { type: 'string' }, code, entry }, [
						'operation',
						'type',
						'name',
						'code',
					]),
					object({ operation: { const: 'delete' }, type: blockType, name: { type: 'string' } }, [
						'operation',
						'type',
						'name',
					]),
				],
			},
		},
	},
	['expectedRevision', 'edits']
);
