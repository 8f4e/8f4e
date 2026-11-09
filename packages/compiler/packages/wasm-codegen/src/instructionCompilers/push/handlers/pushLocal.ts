import type { CodegenContext, ResolvedLocalPushLine } from '@8f4e/language-spec';
import { wasmLocalGet as localGet } from '@8f4e/language-spec';
import { saveByteCode } from '../../utils/saveByteCode';

/**
 * Emits bytecode for pushing a local value onto the stack.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function pushLocal(line: ResolvedLocalPushLine, context: CodegenContext): CodegenContext {
	return saveByteCode(context, localGet(line.resolvedTarget.binding.id));
}
