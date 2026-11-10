import {
	WASM_BLOCK,
	WASM_BR,
	WASM_END,
	WASM_LOOP,
	WASM_RETURN,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
} from '@8f4e/compiler-wasm-utils';
import type { FunctionInliningOptions, WasmIR, WasmIRFunction, WasmIRInstruction } from '@8f4e/language-spec';
import { pruneUnreachableFunctions } from '@8f4e/wasm-ir-pruner';
import { findRecursiveNodes } from './callGraph';

const MAX_WASM_LOCAL_SLOTS = 50_000;
const DEFAULT_DUPLICATED_BODY_GROWTH_LIMIT = 128;

function getCalls(func: WasmIRFunction): string[] {
	const calls: string[] = [];
	for (const instruction of func.body?.instructions ?? []) {
		if (typeof instruction !== 'number' && instruction.kind === 'call') calls.push(instruction.targetFunctionId);
	}
	return calls;
}

interface Expansion {
	locals: NonNullable<WasmIRFunction['body']>['locals'];
	instructions: WasmIRInstruction[];
}

function prepareExpansion(func: WasmIRFunction): Expansion {
	const { instructions, locals } = func.body!;
	const parameters = func.signature.params.length;
	const initialized = new Set<number>();
	const needsZero = new Set<number>();
	let beforeControlFlow = true;
	let needsExit = false;
	let depth = 0;
	const body = instructions.map<WasmIRInstruction>(instruction => {
		if (instruction === WASM_RETURN) {
			beforeControlFlow = false;
			needsExit = true;
			return { kind: 'branch', opcode: WASM_BR, depth };
		}
		if (instruction === WASM_END) depth--;
		if (typeof instruction === 'number') return instruction;
		switch (instruction.kind) {
			case 'block':
				beforeControlFlow = false;
				depth++;
				break;
			case 'branch':
				beforeControlFlow = false;
				needsExit ||= instruction.depth === depth;
				break;
			case 'local.get':
				if (instruction.binding >= parameters && !initialized.has(instruction.binding)) {
					needsZero.add(instruction.binding);
				}
				break;
			case 'local.set':
			case 'local.tee':
				if (beforeControlFlow) initialized.add(instruction.binding);
				break;
		}
		return instruction;
	});

	const expansion: WasmIRInstruction[] = [];
	for (let binding = parameters - 1; binding >= 0; binding--) {
		expansion.push({ kind: 'local.set', binding });
	}
	for (const binding of [...needsZero].sort((a, b) => a - b)) {
		const type = locals[binding];
		expansion.push(
			{ kind: type === WASM_TYPE_F32 ? 'f32.const' : type === WASM_TYPE_F64 ? 'f64.const' : 'i32.const', value: 0 },
			{ kind: 'local.set', binding }
		);
	}
	if (needsExit) expansion.push({ kind: 'block', opcode: WASM_BLOCK, results: func.signature.results });
	for (const instruction of body) expansion.push(instruction);
	if (needsExit) expansion.push(WASM_END);
	return { locals, instructions: expansion };
}

function isScalarLeaf(func: WasmIRFunction): boolean {
	return func.body!.instructions.every(instruction => {
		if (typeof instruction === 'number') return instruction !== WASM_RETURN;
		return (
			instruction.kind === 'local.get' ||
			instruction.kind === 'local.set' ||
			instruction.kind === 'local.tee' ||
			instruction.kind === 'i32.const' ||
			instruction.kind === 'f32.const' ||
			instruction.kind === 'f64.const' ||
			(instruction.kind === 'block' && instruction.opcode !== WASM_LOOP) ||
			instruction.kind === 'prefixed'
		);
	});
}

/** Inlines direct calls in the complete module before assigning numeric indices. */
export function inlineFunctions(
	ir: WasmIR,
	{
		maxExpansionOperations = Infinity,
		maxCallerGrowth,
		pruneFunctions = true,
	}: FunctionInliningOptions & { pruneFunctions?: boolean } = {}
): WasmIR {
	const callerGrowthLimit = maxCallerGrowth ?? DEFAULT_DUPLICATED_BODY_GROWTH_LIMIT;
	const functions = new Map(ir.functions);
	const exports = new Set(ir.exports.values());
	const recursive = findRecursiveNodes(new Map([...functions].map(([id, func]) => [id, getCalls(func)])));
	const growth = new Map<string, number>();
	let changed = false;
	while (true) {
		const counts = new Map<string, number>();
		for (const func of functions.values()) {
			for (const target of getCalls(func)) counts.set(target, (counts.get(target) ?? 0) + 1);
		}
		const candidates = new Map<string, Expansion & { duplicatesBody: boolean }>();
		for (const [id, func] of functions) {
			if (!func.body || !counts.has(id) || recursive.has(id)) continue;
			const duplicatesBody = counts.get(id) !== 1 || exports.has(id);
			if (duplicatesBody && !isScalarLeaf(func)) continue;
			const expansion = prepareExpansion(func);
			if (expansion.instructions.length <= maxExpansionOperations) {
				candidates.set(id, { ...expansion, duplicatesBody });
			}
		}
		let changedThisRound = false;
		for (const [id, func] of functions) {
			if (!func.body) continue;
			const { instructions, locals } = func.body;
			let rewritten: WasmIRInstruction[] | undefined;
			let expandedLocals: (typeof locals)[number][] | undefined;
			let usedGrowth = growth.get(id) ?? 0;
			for (const [index, instruction] of instructions.entries()) {
				const target =
					typeof instruction !== 'number' && instruction.kind === 'call' ? instruction.targetFunctionId : undefined;
				const candidate = target === undefined ? undefined : candidates.get(target);
				const offset = expandedLocals?.length ?? locals.length;
				const extra =
					candidate && (maxCallerGrowth !== undefined || candidate.duplicatesBody)
						? Math.max(0, candidate.instructions.length - 1)
						: 0;
				if (
					!candidate ||
					usedGrowth + extra > callerGrowthLimit ||
					offset + candidate.locals.length > MAX_WASM_LOCAL_SLOTS
				) {
					rewritten?.push(instruction);
					continue;
				}
				rewritten ??= instructions.slice(0, index);
				expandedLocals ??= [...locals];
				for (const type of candidate.locals) expandedLocals.push(type);
				for (const operation of candidate.instructions) {
					rewritten.push(
						typeof operation !== 'number' &&
							(operation.kind === 'local.get' || operation.kind === 'local.set' || operation.kind === 'local.tee')
							? { ...operation, binding: operation.binding + offset }
							: operation
					);
				}
				usedGrowth += extra;
			}
			if (rewritten) {
				functions.set(id, { signature: func.signature, body: { instructions: rewritten, locals: expandedLocals! } });
				growth.set(id, usedGrowth);
				changedThisRound = true;
			}
		}
		if (!changedThisRound) break;
		changed = true;
		if (pruneFunctions) pruneUnreachableFunctions(functions, exports);
	}
	return changed ? { ...ir, functions } : ir;
}
