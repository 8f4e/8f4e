import wabt from 'wabt';

export async function disassembleWasm(codeBuffer: Uint8Array): Promise<string> {
	const api = await wabt();
	const module = api.readWasm(codeBuffer, { threads: true });
	try {
		return module.toText({ foldExprs: false });
	} finally {
		module.destroy();
	}
}

export function getWasmFunctionExportIndex(wat: string, exportName: string): number {
	const exports = wat.matchAll(/^ {2}\(export "([^"]+)" \(func (\d+)\)\)/gm);
	for (const [, name, index] of exports) {
		if (name === exportName) return Number(index);
	}
	throw new Error(`Missing Wasm function export ${exportName}`);
}
