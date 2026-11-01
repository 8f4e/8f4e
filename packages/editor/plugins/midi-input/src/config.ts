import type { EditorConfigSchemaContribution, State } from '@8f4e/editor-state-types';

export const midiEditorConfigSchemaContribution: EditorConfigSchemaContribution = {
	root: 'midi',
	schema: {
		type: 'object',
		properties: {
			inputs: {
				type: 'object',
				additionalProperties: {
					type: 'object',
					properties: {
						port: { type: 'integer', minimum: 0 },
						callback: { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
					},
					additionalProperties: false,
				},
			},
		},
		additionalProperties: false,
	},
};

export function resolveMidiInputBindings(state: State) {
	const config = state.editorConfig.midi as
		| { inputs?: Record<string, { port?: number; callback?: string }> }
		| undefined;
	const bindings: Array<{ port: string; exportName: string }> = [];
	const seen = new Set<string>();
	for (const { port, callback } of Object.values(config?.inputs ?? {})) {
		// Configuration can be incomplete while its separate @config lines are being edited.
		if (port === undefined || callback === undefined) continue;
		const key = `${port}\u0000${callback}`;
		if (seen.has(key)) continue;
		seen.add(key);
		bindings.push({ port: String(port), exportName: callback });
	}
	return bindings;
}
