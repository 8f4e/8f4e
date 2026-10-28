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

interface ObjectSchema {
	type: string;
	properties: Record<string, unknown>;
	required: string[];
	additionalProperties: boolean;
}

export const objectInput = (properties: Record<string, unknown>, required: string[]): ObjectSchema => ({
	type: 'object',
	properties,
	required,
	additionalProperties: false,
});

export const emptyInput = objectInput({}, []);

export interface ToolDefinition {
	name: string;
	title: string;
	description: string;
	inputSchema: ObjectSchema;
	readOnly: boolean;
	run(input: Record<string, unknown>): unknown;
}

/** Validate the argument envelope here; domain handlers validate values in their required order. */
export function objectArguments(input: unknown, properties: Record<string, unknown>): Record<string, unknown> {
	if (
		!input ||
		typeof input !== 'object' ||
		Array.isArray(input) ||
		Object.keys(input).some(key => !Object.hasOwn(properties, key))
	) {
		throw new Error('Invalid tool arguments');
	}
	return input as Record<string, unknown>;
}

export function toolError(code: string, message: string): never {
	throw Object.assign(new Error(message), { code });
}

export const sourceChangedMessage =
	'The project changed since your last source fetch or successful edit. Re-fetch with get_project or get_block before writing.';

export function createWebMcpTool(definition: ToolDefinition, isDisposed: () => boolean): WebMcpTool {
	const { name, title, description, inputSchema, readOnly, run } = definition;
	const failure = (code: string, message: string) => ({ error: { code, message } });
	return {
		name,
		title,
		description,
		inputSchema,
		annotations: { readOnlyHint: readOnly, untrustedContentHint: true },
		async execute(input, options) {
			if (isDisposed())
				return failure('disposed', 'This bridge has been disposed; read the newly opened project before editing');
			if (options?.signal.aborted) return failure('cancelled', 'Tool execution was cancelled');
			try {
				const result = run(objectArguments(input, inputSchema.properties));
				// Live editor actions finish synchronously; only lazy reference reads yield.
				if (!(result instanceof Promise)) return result;
				const value = await result;
				if (isDisposed()) return failure('disposed', 'This bridge has been disposed');
				if (options?.signal.aborted) return failure('cancelled', 'Tool execution was cancelled');
				return value;
			} catch (error) {
				if (error instanceof Error) {
					const details = error as Error & { code?: string };
					return failure(
						details.code ?? 'invalid_request',
						details.code === 'stale_revision' ? sourceChangedMessage : details.message
					);
				}
				return failure('invalid_request', String(error));
			}
		},
	};
}
