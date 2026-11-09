import { i32const } from '@8f4e/compiler-wasm-utils';
import { type CodegenContext, getMemoryBaseType, type ResolvedReferencePushLine } from '@8f4e/language-spec';
import { saveByteCode } from '../../utils/saveByteCode';
import { typedLoad } from '../typedLoad';

/** Loads directly from a statically resolved reference, without reading a pointer slot. */
export default function pushReference(line: ResolvedReferencePushLine, context: CodegenContext): CodegenContext {
	const { slot } = line.resolvedTarget;
	return saveByteCode(context, [
		...i32const(slot.targetMemory.byteAddress),
		...typedLoad(getMemoryBaseType(slot.targetMemory)),
	]);
}
