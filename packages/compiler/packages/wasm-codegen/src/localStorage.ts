import type { CodegenContext, LocalBinding, LocalValueMetadata } from '@8f4e/language-spec';

/** Appends a local to the current Wasm body and returns its slot. */
export function allocateLocal(context: Pick<CodegenContext, 'locals'>, binding: LocalValueMetadata): LocalBinding {
	const local = { ...binding, index: context.locals.length };
	context.locals.push(local);
	return local;
}
