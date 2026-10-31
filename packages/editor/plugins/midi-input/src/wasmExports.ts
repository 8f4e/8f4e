import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/language-spec';

export function createWasmExports({
	getMemory,
	getCodeBuffer,
}: {
	getMemory: () => WebAssembly.Memory | null;
	getCodeBuffer: () => Uint8Array;
}) {
	let cachedMemory: WebAssembly.Memory | null = null;
	let cachedCode: Uint8Array | undefined;
	let pending: Promise<WebAssembly.Exports> | undefined;

	return async (): Promise<WebAssembly.Exports | undefined> => {
		const memory = getMemory();
		const code = getCodeBuffer();
		if (!memory || code.length === 0) return;
		if (!pending || cachedMemory !== memory || cachedCode !== code) {
			cachedMemory = memory;
			cachedCode = code;
			const result = WebAssembly.instantiate(new Uint8Array(code), {
				host: { memory, ...IGNORED_ASSERTION_IMPORTS },
			}).then(({ instance }) => instance.exports);
			pending = result;
			void result.catch(() => {
				if (pending === result) pending = undefined;
			});
		}
		return pending;
	};
}
