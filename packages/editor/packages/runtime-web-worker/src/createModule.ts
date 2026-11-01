import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/language-spec';

export default async function createModule(
	memoryRef: WebAssembly.Memory,
	codeBuffer: Uint8Array,
	entryName = 'main'
): Promise<{
	memoryBuffer: Int32Array;
	entry: CallableFunction;
	initDefaults: CallableFunction;
	buffer: CallableFunction;
}> {
	const memoryBuffer = new Int32Array(memoryRef.buffer);

	const { instance } = (await WebAssembly.instantiate(codeBuffer, {
		host: {
			memory: memoryRef,
			...IGNORED_ASSERTION_IMPORTS,
		},
	})) as unknown as { instance: WebAssembly.Instance; module: WebAssembly.Module };

	const entry = instance.exports[entryName] as CallableFunction;
	const buffer = instance.exports.buffer as CallableFunction;
	const initDefaults = instance.exports.initDefaults as CallableFunction;

	return { memoryBuffer, entry, buffer, initDefaults };
}
