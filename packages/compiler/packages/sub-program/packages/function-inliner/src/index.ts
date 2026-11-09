import { f32const, f64const, i32const } from '@8f4e/compiler-wasm-utils';
import type { FunctionAnalysisReport, FunctionBodyFacts } from '@8f4e/function-analyzer';
import type {
	CodegenInstructionName,
	FunctionInliningOptions,
	WasmIR,
	WasmIRBody,
	WasmIRInstruction,
} from '@8f4e/language-spec';
import { wasmLocalSet } from '@8f4e/language-spec';

/** V8 counts parameters and declared locals toward the same per-function limit. */
const MAX_WASM_LOCAL_SLOTS = 50_000;

const scalarInstructions: ReadonlySet<CodegenInstructionName> = new Set([
	'abs',
	'add',
	'and',
	'castToFloat',
	'castToFloat64',
	'castToInt',
	'div',
	'drop',
	'equal',
	'equalToZero',
	'greaterOrEqual',
	'greaterOrEqualUnsigned',
	'greaterThan',
	'lessOrEqual',
	'lessThan',
	'localSet',
	'max',
	'min',
	'mul',
	'notEqual',
	'notZero',
	'or',
	'push',
	'remainder',
	'round',
	'shiftLeft',
	'shiftRight',
	'shiftRightUnsigned',
	'sqrt',
	'sub',
	'xor',
]);

interface Candidate {
	callee: WasmIRBody;
	growth: number;
}

function hasScalarBody(body: FunctionBodyFacts): boolean {
	return (
		!body.hasPointerBindings &&
		!body.hasPointerReturns &&
		body.instructionKinds.every(instruction => scalarInstructions.has(instruction)) &&
		body.pushOperandKinds.every(kind => kind === 'literal' || kind === 'local')
	);
}

function getCandidates(
	functions: WasmIR['functions'],
	functionAnalysis: FunctionAnalysisReport,
	maxExpansionOperations: number
): ReadonlyMap<string, Candidate> {
	const candidates = new Map<string, Candidate>();
	for (const [id, callee] of Object.entries(functions)) {
		const { analysis, bodyFacts } = functionAnalysis.functions[id];
		if (analysis.isImported || !hasScalarBody(bodyFacts)) continue;

		const localCount = callee.sourceBindingCount - callee.parameterCount;
		const expansionSize = bodyFacts.operationCount + callee.parameterCount + localCount * 2;
		if (expansionSize <= maxExpansionOperations) {
			candidates.set(id, { callee, growth: Math.max(0, expansionSize - 1) });
		}
	}
	return candidates;
}

function expandCall(instructions: WasmIRInstruction[], callee: WasmIRBody, bindingOffset: number): void {
	// The last argument is on top of the caller's stack.
	for (let index = callee.parameterCount - 1; index >= 0; index--) {
		instructions.push(...wasmLocalSet(bindingOffset + index));
	}
	// Restore Wasm's zero-initialization of declared locals on each execution.
	for (let index = callee.parameterCount; index < callee.sourceBindingCount; index++) {
		const local = callee.locals[index];
		const zero = local.isInteger ? i32const(0) : local.isFloat64 ? f64const(0) : f32const(0);
		instructions.push(...zero, ...wasmLocalSet(bindingOffset + index));
	}
	for (const instruction of callee.instructions) {
		if (typeof instruction !== 'number' && (instruction.kind === 'local.get' || instruction.kind === 'local.set')) {
			instructions.push({ ...instruction, binding: bindingOffset + instruction.binding });
		} else {
			instructions.push(instruction);
		}
	}
}

function rewriteBody(
	original: WasmIRBody,
	candidates: ReadonlyMap<string, Candidate>,
	maxCallerGrowth: number
): WasmIRBody {
	let instructions: WasmIRInstruction[] | undefined;
	let locals: WasmIRBody['locals'][number][] | undefined;
	let remainingGrowth = maxCallerGrowth;
	for (const [index, instruction] of original.instructions.entries()) {
		const candidate =
			typeof instruction !== 'number' && instruction.kind === 'call'
				? candidates.get(instruction.targetFunctionId)
				: undefined;
		const localCount = (locals ?? original.locals).length;
		if (
			candidate &&
			candidate.growth <= remainingGrowth &&
			localCount + candidate.callee.locals.length <= MAX_WASM_LOCAL_SLOTS
		) {
			instructions ??= original.instructions.slice(0, index);
			locals ??= [...original.locals];
			expandCall(instructions, candidate.callee, localCount);
			locals.push(...candidate.callee.locals);
			remainingGrowth -= candidate.growth;
		} else {
			instructions?.push(instruction);
		}
	}
	return instructions && locals ? { ...original, instructions, locals } : original;
}

function rewriteBodies(
	bodies: WasmIR['functions'],
	candidates: ReadonlyMap<string, Candidate>,
	maxCallerGrowth: number
): WasmIR['functions'] {
	let rewritten: Record<string, WasmIRBody> | undefined;
	for (const [id, body] of Object.entries(bodies)) {
		const result = rewriteBody(body, candidates, maxCallerGrowth);
		if (result !== body) {
			rewritten ??= { ...bodies };
			rewritten[id] = result;
		}
	}
	return rewritten ?? bodies;
}

/** Replaces eligible calls in Wasm IR using the slots already declared by lowering. */
export function inlineFunctions(
	ir: WasmIR,
	functionAnalysis: FunctionAnalysisReport,
	{
		maxExpansionOperations = Number.POSITIVE_INFINITY,
		maxCallerGrowth = Number.POSITIVE_INFINITY,
	}: FunctionInliningOptions = {}
): WasmIR {
	const candidates = getCandidates(ir.functions, functionAnalysis, maxExpansionOperations);
	if (candidates.size === 0) return ir;
	const modules = rewriteBodies(ir.modules, candidates, maxCallerGrowth);
	const functions = rewriteBodies(ir.functions, candidates, maxCallerGrowth);
	return modules === ir.modules && functions === ir.functions ? ir : { modules, functions };
}
