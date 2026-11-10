import type { WasmIR, WasmIRFunction, WasmIRInstruction } from '@8f4e/language-spec';

/** Removes unreachable definitions and imports from a pass-owned function table. */
export function pruneUnreachableFunctions(functions: Map<string, WasmIRFunction>, roots: Iterable<string>): void {
	const live = new Set(roots);
	for (const id of live) {
		for (const instruction of functions.get(id)!.body?.instructions ?? []) {
			if (typeof instruction !== 'number' && instruction.kind === 'call') live.add(instruction.targetFunctionId);
		}
	}
	for (const id of functions.keys()) {
		if (!live.has(id)) functions.delete(id);
	}
}

function isLocalReference(
	instruction: WasmIRInstruction
): instruction is Extract<WasmIRInstruction, { kind: 'local.get' | 'local.set' }> {
	return typeof instruction !== 'number' && (instruction.kind === 'local.get' || instruction.kind === 'local.set');
}

function pruneLocals(func: WasmIRFunction): WasmIRFunction {
	if (!func.body) return func;
	const parameterCount = func.signature.params.length;
	const { locals, instructions } = func.body;
	if (locals.length === parameterCount) return func;

	const used = new Set<number>();
	for (const instruction of instructions) {
		if (isLocalReference(instruction) && instruction.binding >= parameterCount) used.add(instruction.binding);
	}
	if (used.size === locals.length - parameterCount) return func;

	const compacted = locals.slice(0, parameterCount);
	const bindings = new Map<number, number>();
	for (let slot = parameterCount; slot < locals.length; slot++) {
		if (!used.has(slot)) continue;
		bindings.set(slot, compacted.length);
		compacted.push(locals[slot]);
	}
	return {
		...func,
		body: {
			locals: compacted,
			instructions: instructions.map(instruction =>
				isLocalReference(instruction) && instruction.binding >= parameterCount
					? { ...instruction, binding: bindings.get(instruction.binding)! }
					: instruction
			),
		},
	};
}

/** Keeps exported functions and their callees, and compacts referenced local slots in their bodies. */
export function pruneWasmIR(ir: WasmIR): WasmIR {
	const functions = new Map(ir.functions);
	pruneUnreachableFunctions(functions, ir.exports.values());
	for (const [id, func] of functions) functions.set(id, pruneLocals(func));
	return { ...ir, functions };
}
