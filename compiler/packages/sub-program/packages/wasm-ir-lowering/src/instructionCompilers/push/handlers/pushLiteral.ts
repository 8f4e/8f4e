import type { CodegenContext, ResolvedArgumentLiteral } from '@8f4e/language-spec';
import { saveByteCode } from '../../utils/saveByteCode';
import { constOpcode, resolveArgumentValueKind } from '../shared';

/**
 * Emits bytecode for pushing a numeric literal onto the stack.
 *
 * @param argument - Argument whose resolved value or metadata should be used.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function pushLiteral(argument: ResolvedArgumentLiteral, context: CodegenContext): CodegenContext {
	const kind = resolveArgumentValueKind(argument);
	return saveByteCode(context, constOpcode[kind](argument.value));
}
