import { WASM_MEMORY_PAGE_SIZE, WASM_TYPE_F32, WASM_TYPE_F64, WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type {
	AssertionCodegenSites,
	AssertionImport,
	ComposedAST,
	ComposedEntry,
	ComposedFunctionAST,
	ComposedModuleAST,
	MemoryDefaults,
	MemoryLayoutPlan,
	StackAnalysisLineFacts,
	WasmIR,
	WasmIRBody,
	WasmIRFunction,
	WasmIRInstruction,
} from '@8f4e/language-spec';
import { assertionFunctionId, BlockType, createFunctionId, DEFAULT_HOST_IMPORT_MODULE_NAME } from '@8f4e/language-spec';
import type {
	FunctionSemanticReferences,
	ModuleSemanticReferences,
	SemanticReferenceReport,
} from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';
import { compileCodegenLine } from './compileLine';
import { createCodegenContext } from './createCodegenContext';
import { functionValueTypeToWasmType } from './functionValueType';
import createInitialMemoryDataSegments from './initialMemoryDataSegments/createInitialMemoryDataSegments';
import { i32const } from './operations';

function lowerBody(
	resolved: FunctionSemanticReferences | ModuleSemanticReferences,
	facts: readonly StackAnalysisLineFacts[],
	assertions?: AssertionCodegenSites
): WasmIRBody {
	const { ast, bindings, body } = resolved;
	const blockType = 'metadata' in resolved ? BlockType.FUNCTION : BlockType.MODULE;
	const context = createCodegenContext(
		{
			blockStack: [{ blockType, expectedResultTypes: [] }],
			codeBlockType: ast.type,
			codeBlockId: 'metadata' in resolved ? resolved.metadata.name : resolved.ast.id,
			projectBlockId: ast.projectBlockId,
			source: ast.source,
		},
		bindings
	);

	for (const [index, { line }] of body.entries()) {
		compileCodegenLine(line, facts[index], context, assertions?.get(index));
	}
	return {
		instructions: context.instructions,
		locals: context.locals.map(local =>
			local.isInteger ? WASM_TYPE_I32 : local.isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32
		),
	};
}

function moduleCycleFunctionId(moduleId: string): string {
	return `\0cycle:${moduleId}`;
}

const initDefaultsId = '\0initDefaults';
const voidSignature = { params: [], results: [] };

interface LowerModuleInput {
	references: SemanticReferenceReport<ComposedModuleAST, ComposedFunctionAST>;
	stackReport: StackAnalysisSubProgramReport;
	entries: readonly ComposedEntry[];
	memoryPlan: MemoryLayoutPlan;
	requiredMemoryBytes: number;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	assertionCalls?: ReadonlyMap<ComposedAST, AssertionCodegenSites>;
	assertionImports?: readonly AssertionImport[];
}

/** Lowers a resolved program to a complete Wasm module with symbolic references. */
export function lowerToWasmIR({
	references,
	stackReport,
	entries,
	memoryPlan,
	memoryDefaultsByModuleId,
	requiredMemoryBytes,
	assertionCalls,
	assertionImports = [],
}: LowerModuleInput): WasmIR {
	const functions = new Map<string, WasmIRFunction>();
	const exports = new Map<string, string>();
	const dataSegments = new Map<string, Uint8Array>();
	const initialize: WasmIRInstruction[] = [];
	if (requiredMemoryBytes > 0) {
		initialize.push(...i32const(0), ...i32const(0), ...i32const(requiredMemoryBytes), { kind: 'memory.fill' });
	}
	for (const [index, segment] of createInitialMemoryDataSegments(memoryPlan, memoryDefaultsByModuleId).entries()) {
		const dataSegmentId = String(index);
		dataSegments.set(dataSegmentId, segment.bytes);
		initialize.push(...i32const(segment.byteAddress), ...i32const(0), ...i32const(segment.bytes.length), {
			kind: 'memory.init',
			dataSegmentId,
		});
	}
	functions.set(initDefaultsId, { signature: voidSignature, body: { locals: [], instructions: initialize } });
	exports.set('initDefaults', initDefaultsId);

	for (const entry of entries) {
		const id = createFunctionId(entry.id, []);
		const instructions = entry.steps.flatMap<WasmIRInstruction>(step => {
			if (step.type === 'module' && references.modules[step.id].skipExecutionInCycle) return [];
			return [
				{
					kind: 'call',
					targetFunctionId: step.type === 'module' ? moduleCycleFunctionId(step.id) : createFunctionId(step.id, []),
				},
			];
		});
		functions.set(id, { signature: voidSignature, body: { locals: [], instructions } });
		if (entry.exportName !== undefined) exports.set(entry.exportName, id);
	}

	for (const [id, resolved] of Object.entries(references.functions)) {
		const { metadata, ast } = resolved;
		const signature = {
			params: metadata.signature.parameters.map(parameter => functionValueTypeToWasmType(parameter.type)),
			results: metadata.signature.returns.map(functionValueTypeToWasmType),
		};
		functions.set(
			id,
			metadata.import
				? { signature, import: metadata.import }
				: { signature, body: lowerBody(resolved, stackReport.functions[id].operationFacts, assertionCalls?.get(ast)) }
		);
		if (metadata.exportName) exports.set(metadata.exportName, id);
	}

	for (const { moduleName, fieldName, signature } of assertionImports) {
		functions.set(assertionFunctionId(fieldName), { signature, import: { moduleName, fieldName } });
	}
	for (const [id, resolved] of Object.entries(references.modules)) {
		functions.set(moduleCycleFunctionId(id), {
			signature: voidSignature,
			body: lowerBody(resolved, stackReport.modules[id].operationFacts, assertionCalls?.get(resolved.ast)),
		});
	}

	const pages = Math.max(1, Math.ceil(requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE));
	return {
		functions,
		exports,
		memory: { moduleName: DEFAULT_HOST_IMPORT_MODULE_NAME, fieldName: 'memory', minPages: pages, maxPages: pages },
		dataSegments,
	};
}
