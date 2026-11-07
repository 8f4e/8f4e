import { localGet } from '@8f4e/compiler-wasm-utils';
import type { CodegenContext, PointerLocalBinding, ResolvedLocalPointerPushLine } from '@8f4e/language-spec';
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
	const local = context.locals[line.resolvedTarget.binding.id]! as PointerLocalBinding;
	const { dereferenceDepth } = line.arguments[0];
	const dereference = buildPointerDereferenceByteCode(
		context,
		local,
		localGet(local.index),
		'pointer-value',
		dereferenceDepth
	);

	return saveByteCode(context, dereference.byteCode);
}
