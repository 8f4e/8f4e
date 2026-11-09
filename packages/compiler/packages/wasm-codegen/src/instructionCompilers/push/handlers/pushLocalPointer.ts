import type { CodegenContext, PointerLocalMetadata, ResolvedLocalPointerPushLine } from '@8f4e/language-spec';
import { wasmLocalGet as localGet } from '@8f4e/language-spec';
import { saveByteCode } from '../../utils/saveByteCode';
import { buildPointerDereferenceByteCode } from '../shared';

/**
 * Emits bytecode for pushing the value reached by dereferencing a local pointer.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function pushLocalPointer(line: ResolvedLocalPointerPushLine, context: CodegenContext): CodegenContext {
	const { id } = line.resolvedTarget.binding;
	const local = context.locals[id] as PointerLocalMetadata;
	const { dereferenceDepth } = line.arguments[0];
	const dereference = buildPointerDereferenceByteCode(context, local, localGet(id), 'pointer-value', dereferenceDepth);

	return saveByteCode(context, dereference.byteCode);
}
