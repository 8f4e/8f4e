import type { CodegenContext, LocalValueMetadata } from '@8f4e/language-spec';

/** Appends a local to the current Wasm body and returns its slot. */
export function allocateLocal(context: Pick<CodegenContext, 'locals'>, metadata: LocalValueMetadata): number {
	const index = context.locals.length;
	context.locals.push(metadata);
	return index;
}
