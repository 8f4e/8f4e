import type { CodegenContext, ResolvedMemoryPointerPushLine } from '@8f4e/language-spec';
import { i32const } from '../../../operations';
import { saveByteCode } from '../../utils/saveByteCode';
import { buildPointerDereferenceByteCode } from '../shared';

/**
 * Emits bytecode for pushing the value reached by dereferencing a memory pointer.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function pushMemoryPointer(
	line: ResolvedMemoryPointerPushLine,
	context: CodegenContext
): CodegenContext {
	const { memoryItem } = line.resolvedTarget;
	const { dereferenceDepth } = line.arguments[0];
	const dereference = buildPointerDereferenceByteCode(
		context,
		memoryItem,
		i32const(memoryItem.byteAddress),
		'pointer-slot',
		dereferenceDepth
	);

	return saveByteCode(context, dereference.byteCode);
}
