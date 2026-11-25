import { type CodegenContext, getMemoryBaseType, type ResolvedReferencePushLine } from '@8f4e/language-spec';
import { i32const } from '../../../operations';
import { saveByteCode } from '../../utils/saveByteCode';
import { buildPointerDereferenceByteCode } from '../shared';
import { typedLoad } from '../typedLoad';

/** Reads the bound allocation directly, guarding any access through its live pointer value. */
export default function pushReference(line: ResolvedReferencePushLine, context: CodegenContext): CodegenContext {
	const { targetMemory } = line.resolvedTarget.slot;
	const address = i32const(targetMemory.byteAddress);
	const { dereferenceDepth } = line.arguments[0];
	if (dereferenceDepth === 1) {
		return saveByteCode(context, [...address, ...typedLoad(getMemoryBaseType(targetMemory))]);
	}
	const { byteCode } = buildPointerDereferenceByteCode(
		context,
		targetMemory,
		address,
		'pointer-slot',
		dereferenceDepth - 1
	);
	return saveByteCode(context, byteCode);
}
