const code = { type: 'array', minItems: 1, items: { type: 'string', pattern: '^[^\\r\\n]*$' } };
const position = { type: 'integer' };
const blockId = { type: 'string', description: 'Opaque blockId from get_project at the expected revision.' };
const entry = { type: 'string', minLength: 1, pattern: '^\\S+$' };

const object = (properties: Record<string, unknown>, required: string[]) => ({
	type: 'object',
	properties,
	required,
	additionalProperties: false,
});

export const emptySchema = object({}, []);
export const revisionSchema = object({ expectedRevision: { type: 'string' } }, ['expectedRevision']);
export const editsSchema = object(
	{
		expectedRevision: { type: 'string', description: 'Opaque revision from the latest get_project result.' },
		edits: {
			type: 'array',
			minItems: 1,
			items: {
				oneOf: [
					object(
						{ type: { const: 'insert' }, code, x: position, y: position, projectPath: { type: 'string' }, entry },
						['type', 'code']
					),
					object({ type: { const: 'update' }, blockId, code, entry }, ['type', 'blockId', 'code']),
					object({ type: { const: 'move' }, blockId, x: position, y: position }, ['type', 'blockId', 'x', 'y']),
					object({ type: { const: 'delete' }, blockId }, ['type', 'blockId']),
				],
			},
		},
	},
	['expectedRevision', 'edits']
);
