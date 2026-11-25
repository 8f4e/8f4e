import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/language-spec';

const noop = () => {
	return;
};

export default async function createModule(
	memoryRef: WebAssembly.Memory,
	codeBuffer: Uint8Array,
	bufferExportName = 'buffer'
): Promise<{
	memoryBuffer: Float32Array;
	buffer: CallableFunction;
	initDefaults: CallableFunction;
}> {
	const memoryBuffer = new Float32Array(memoryRef.buffer);

	const { instance } = (await WebAssembly.instantiate(codeBuffer, {
		host: {
			memory: memoryRef,
			...IGNORED_ASSERTION_IMPORTS,
		},
	})) as unknown as { instance: WebAssembly.Instance; module: WebAssembly.Module };

	const exportedBuffer = instance.exports[bufferExportName];
	const buffer = typeof exportedBuffer === 'function' ? exportedBuffer : noop;
	const initDefaults = instance.exports.initDefaults as CallableFunction;

	return { memoryBuffer, buffer, initDefaults };
}
