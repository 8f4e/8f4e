import type { WasmIR, WasmIRFunction, WasmIRInstruction } from '@8f4e/language-spec';

/** Fuses each adjacent write and read of the same local into a single tee. */
export function simplifyWasmLocals(ir: WasmIR): WasmIR {
	let functions: Map<string, WasmIRFunction> | undefined;
	for (const [id, func] of ir.functions) {
		if (!func.body) continue;
		const { instructions } = func.body;
		let rewritten: WasmIRInstruction[] | undefined;
		for (let index = 0; index < instructions.length; index++) {
			const instruction = instructions[index];
			const next = instructions[index + 1];
			if (
				typeof instruction === 'object' &&
				instruction.kind === 'local.set' &&
				typeof next === 'object' &&
				next.kind === 'local.get' &&
				instruction.binding === next.binding
			) {
				rewritten ??= instructions.slice(0, index);
				rewritten.push({ kind: 'local.tee', binding: instruction.binding });
				index++;
			} else {
				rewritten?.push(instruction);
			}
		}
		if (rewritten) {
			functions ??= new Map(ir.functions);
			functions.set(id, { ...func, body: { ...func.body, instructions: rewritten } });
		}
	}
	return functions ? { ...ir, functions } : ir;
}
