import { i32const } from '@8f4e/compiler-wasm-utils';
import type { CodegenContext, ResolvedReferencePushLine } from '@8f4e/language-spec';
import { saveByteCode } from '../../utils/saveByteCode';
import { buildPointerDereferenceByteCode } from '../shared';

/** Loads directly from a statically resolved reference, without reading a pointer slot. */
export default function pushReference(line: ResolvedReferencePushLine, context: CodegenContext): CodegenContext {
	const { slot } = line.resolvedTarget;
	const { byteCode } = buildPointerDereferenceByteCode(
		context,
		line.lineNumber,
		slot,
		i32const(slot.targetMemory.byteAddress),
		'fixed-reference',
		1
	);
	return saveByteCode(context, byteCode);
}
