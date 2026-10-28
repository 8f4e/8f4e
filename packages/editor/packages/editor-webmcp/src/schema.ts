const code = { type: 'string', description: 'Complete source of the block, with newline characters between lines.' };
const entry = { type: 'string', minLength: 1, pattern: '^\\S+$' };

const object = (properties: Record<string, unknown>, required: string[]) => ({
	type: 'object',
	properties,
	required,
	additionalProperties: false,
});

export const emptySchema = object({}, []);
const query = { type: 'string', description: 'Search words, or an empty string to browse the catalog.' };
const offset = { type: 'integer', minimum: 0, description: 'Pagination offset from the previous nextOffset result.' };
const exampleKind = { type: 'string', enum: ['block', 'project'] };
export const searchDocsSchema = object({ query, offset }, ['query']);
export const getDocsSchema = object(
	{ topic: { type: 'string', description: 'Exact topic returned by search_docs.' } },
	['topic']
);
export const searchExamplesSchema = object({ query, kind: exampleKind, offset }, ['query']);
export const getExampleSchema = object(
	{ kind: exampleKind, path: { type: 'string', description: 'Exact path returned by search_examples.' } },
	['kind', 'path']
);
export const groupSchema = object(
	{ name: { type: 'string', description: 'Name of a child group in the currently expanded group or root.' } },
	['name']
);
const blockType = {
	type: 'string',
	enum: ['module', 'function', 'constants', 'prototype', 'includes', 'note', 'unknown', 'group', 'project'],
};
export const blockSchema = object({ type: blockType, name: { type: 'string' } }, ['type', 'name']);
export const updateBlockSchema = object({ type: blockType, name: { type: 'string' }, code }, ['type', 'name', 'code']);
export const patchBlockSchema = object(
	{
		type: blockType,
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
);
export const editsSchema = object(
	{
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
	['edits']
);
