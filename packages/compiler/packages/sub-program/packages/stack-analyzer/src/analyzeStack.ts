import type {
	CompilationContext,
	CompiledStackAnalysisLine,
	CompilerASTLine,
	FunctionCompilationContext,
	FunctionRegistry,
	FunctionTypeRegistry,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	ModuleCompilationContext,
	ResolvedDefaultLine,
	ResolvedMapLine,
	SemanticReferenceLine,
	Stack,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import { ArgumentType, BlockType, ErrorCode, functionValueTypeToLocalMetadata, getError } from '@8f4e/language-spec';
import type {
	FunctionSemanticReferences,
	ModuleSemanticReferences,
	ResolvedOperation,
	SemanticReferenceReport,
} from '@8f4e/semantic-reference-resolver';
import {
	createCompilationContext,
	popBlock,
	pushBlock,
	resolveMapKind,
	withSourceDiagnostic,
} from '@8f4e/semantic-utils';
import { analyzeInstruction } from './analyzeInstruction';
import { cloneStack } from './instructionAnalyzers/stack';
import { validateMapValueKind } from './mapValueKind';

export interface AnalyzeStackSubProgramInput {
	semanticReferences: SemanticReferenceReport;
	memoryPlan: MemoryLayoutPlan;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	functions: FunctionRegistry;
	functionTypeRegistry: FunctionTypeRegistry;
}

export interface StackAnalyzedModule {
	operationFacts: StackAnalysisLineFacts[];
	stackAnalysis: CompiledStackAnalysisLine[];
	finalStack: Stack;
}

export interface StackAnalyzedFunction {
	functionId: string;
	operationFacts: StackAnalysisLineFacts[];
	stackAnalysis: CompiledStackAnalysisLine[];
	finalStack: Stack;
	used?: boolean;
}

export interface StackAnalysisSubProgramReport {
	modules: Record<string, StackAnalyzedModule>;
	functions: Record<string, StackAnalyzedFunction>;
}

function toCompiledStackAnalysisLine(
	line: CompilerASTLine,
	facts: StackAnalysisLineFacts,
	functions: FunctionRegistry
): CompiledStackAnalysisLine {
	return {
		lineNumber: line.lineNumber,
		instruction: line.instruction,
		stackAnalysis: facts.stackAnalysis,
		...(facts.targetFunctionId
			? {
					resolvedCall: {
						targetFunctionId: facts.targetFunctionId,
						signature: functions.byId[facts.targetFunctionId].signature,
					},
				}
			: {}),
	};
}

function getResultTypes(line: CompilerASTLine): Array<'int' | 'float'> {
	const pairedLine = line as CompilerASTLine & {
		blockBlock?: { resultTypes: Array<'int' | 'float'> };
		ifBlock?: { resultTypes: Array<'int' | 'float'> };
	};
	return pairedLine.blockBlock?.resultTypes ?? pairedLine.ifBlock?.resultTypes ?? [];
}

function applyLoopLine(_line: CompilerASTLine, context: CompilationContext): void {
	pushBlock(context, { expectedResultTypes: [], blockType: BlockType.LOOP });
}

function applyMapBeginLine(line: CompilerASTLine, context: CompilationContext): void {
	const inputType = (line.arguments[0] as { value: string }).value;

	pushBlock(context, {
		expectedResultTypes: [],
		blockType: BlockType.MAP,
		mapState: {
			inputIsInteger: inputType === 'int',
			inputIsFloat64: inputType === 'float64',
			rows: [],
			defaultSet: false,
		},
	});
}

function resolveMapArgumentValue(argument: ResolvedMapLine['arguments'][number]) {
	if (argument.type === ArgumentType.LITERAL) {
		return {
			value: argument.value,
			isInteger: argument.isInteger,
			isFloat64: !!argument.isFloat64,
		};
	}

	return {
		value: argument.value.charCodeAt(0),
		isInteger: true,
		isFloat64: false,
	};
}

function applyMapLine(line: ResolvedMapLine, context: CompilationContext): void {
	const { mapState } = context.activeMapBlock!;
	const key = resolveMapArgumentValue(line.arguments[0]);
	const value = resolveMapArgumentValue(line.arguments[1]);
	const inputKind = resolveMapKind({
		valueType: mapState.inputIsInteger ? 'int' : mapState.inputIsFloat64 ? 'float64' : 'float',
	});

	validateMapValueKind(
		{
			valueType: key.isInteger ? 'int' : key.isFloat64 ? 'float64' : 'float',
		},
		inputKind,
		line,
		context
	);

	mapState.rows.push({
		keyValue: key.value,
		valueValue: value.value,
		valueIsInteger: value.isInteger,
		...(value.isFloat64 ? { valueIsFloat64: true } : {}),
	});
}

function applyDefaultLine(line: ResolvedDefaultLine, context: CompilationContext): void {
	const { mapState } = context.activeMapBlock!;
	const valueArg = line.arguments[0];

	mapState.defaultValue = valueArg.value;
	mapState.defaultIsInteger = valueArg.isInteger;
	mapState.defaultIsFloat64 = !!valueArg.isFloat64;
	mapState.defaultSet = true;
}

function applyStackLineEffect(line: SemanticReferenceLine, context: CompilationContext): void {
	switch (line.instruction) {
		case 'block':
			pushBlock(context, { blockType: BlockType.BLOCK, expectedResultTypes: getResultTypes(line) });
			return;
		case 'blockEnd':
		case 'ifEnd':
		case 'loopEnd':
			popBlock(context);
			return;
		case 'if':
			pushBlock(context, { blockType: BlockType.CONDITION, expectedResultTypes: getResultTypes(line) });
			return;
		case 'else': {
			const block = popBlock(context);
			if (block) {
				pushBlock(context, block);
			}
			return;
		}
		case 'loop':
			applyLoopLine(line, context);
			return;
		case 'mapBegin':
			applyMapBeginLine(line, context);
			return;
		case 'map':
			applyMapLine(line as ResolvedMapLine, context);
			return;
		case 'default':
			applyDefaultLine(line as ResolvedDefaultLine, context);
			return;
		case 'mapEnd':
			popBlock(context);
			return;
	}
}

function analyzeSemanticReferenceLine(
	line: SemanticReferenceLine,
	context: CompilationContext
): StackAnalysisLineFacts {
	const facts = analyzeInstruction(line, context);
	applyStackLineEffect(line, context);
	return facts;
}

/** Analyzes each executable operation independently and groups the public view by source line. */
function analyzeBodyOperations(
	sourceLines: readonly CompilerASTLine[],
	body: readonly ResolvedOperation[],
	context: CompilationContext
): { operationFacts: StackAnalysisLineFacts[]; stackAnalysis: CompiledStackAnalysisLine[] } {
	const operationFacts: StackAnalysisLineFacts[] = [];
	const stackAnalysis: CompiledStackAnalysisLine[] = [];
	let previousSourceLineIndex = -1;
	let untouchedSourceValues = 0;
	for (const { sourceLineIndex, line } of body) {
		const facts = withSourceDiagnostic(sourceLines[sourceLineIndex], () => analyzeSemanticReferenceLine(line, context));
		operationFacts.push(facts);
		const operation = facts.stackAnalysis;
		const preservedInputCount = Math.max(
			0,
			operation.stackBefore.length -
				Math.max(operation.consumedOperands.length, operation.droppedStackItems?.length ?? 0)
		);
		if (sourceLineIndex !== previousSourceLineIndex) {
			stackAnalysis.push(
				toCompiledStackAnalysisLine(sourceLines[sourceLineIndex], facts, context.namespace.functions!)
			);
			previousSourceLineIndex = sourceLineIndex;
			untouchedSourceValues = preservedInputCount;
			continue;
		}
		untouchedSourceValues = Math.min(untouchedSourceValues, preservedInputCount);
		const source = stackAnalysis[stackAnalysis.length - 1];
		if (facts.targetFunctionId) {
			source.resolvedCall = {
				targetFunctionId: facts.targetFunctionId,
				signature: context.namespace.functions!.byId[facts.targetFunctionId].signature,
			};
		}
		source.stackAnalysis = {
			stackBefore: source.stackAnalysis.stackBefore,
			stackAfter: operation.stackAfter,
			consumedOperands: source.stackAnalysis.stackBefore.slice(untouchedSourceValues),
			producedStackItems: operation.stackAfter.slice(untouchedSourceValues),
		};
	}
	return { operationFacts, stackAnalysis };
}

function createModuleContext(
	input: AnalyzeStackSubProgramInput,
	resolved: ModuleSemanticReferences
): ModuleCompilationContext {
	const { ast } = resolved;
	const plannedModule = input.memoryPlan.modules[ast.id];
	return createCompilationContext<ModuleCompilationContext>({
		namespace: {
			moduleName: ast.id,
			functions: input.functions,
			prototypeShapeIds: [],
		},
		locals: Object.fromEntries(
			resolved.bindings.map(binding => [binding.id, functionValueTypeToLocalMetadata(binding.type)])
		),
		byteCode: [],
		stack: [],
		blockStack: [{ blockType: BlockType.MODULE, expectedResultTypes: [] }],
		memoryPlan: input.memoryPlan,
		currentPlannedModule: plannedModule,
		pointerMetadataByModuleId: input.pointerMetadataByModuleId,
		mode: 'module',
		codeBlockId: ast.id,
		codeBlockType: 'module',
		functionTypeRegistry: input.functionTypeRegistry,
		projectBlockId: ast.projectBlockId,
		source: ast.source,
	});
}

function analyzeModule(input: AnalyzeStackSubProgramInput, resolved: ModuleSemanticReferences): StackAnalyzedModule {
	const { ast, body } = resolved;
	const context = createModuleContext(input, resolved);
	const { operationFacts, stackAnalysis } = analyzeBodyOperations(ast.lines, body, context);
	if (context.stack.length > 0)
		throw getError(ErrorCode.STACK_EXPECTED_ZERO_ELEMENTS, ast.lines[ast.lines.length - 1], context);
	return { operationFacts, stackAnalysis, finalStack: cloneStack(context.stack) };
}

function createFunctionContext(
	input: AnalyzeStackSubProgramInput,
	resolved: FunctionSemanticReferences
): FunctionCompilationContext {
	const { ast, metadata: functionMetadata } = resolved;
	return createCompilationContext<FunctionCompilationContext>({
		namespace: {
			moduleName: undefined,
			functions: input.functions,
			prototypeShapeIds: [],
		},
		locals: Object.fromEntries(
			resolved.bindings.map(binding => [binding.id, functionValueTypeToLocalMetadata(binding.type)])
		),
		byteCode: [],
		stack: [],
		blockStack: [{ blockType: BlockType.FUNCTION, expectedResultTypes: [] }],
		memoryPlan: input.memoryPlan,
		pointerMetadataByModuleId: input.pointerMetadataByModuleId,
		mode: 'function',
		codeBlockId: functionMetadata.name,
		codeBlockType: 'function',
		projectBlockId: ast.projectBlockId,
		source: ast.source,
		currentFunctionId: functionMetadata.id,
		currentFunctionName: functionMetadata.name,
		currentFunctionMetadata: functionMetadata,

		functionTypeRegistry: input.functionTypeRegistry,
	});
}

function analyzeFunction(
	input: AnalyzeStackSubProgramInput,
	resolved: FunctionSemanticReferences
): StackAnalyzedFunction {
	const { ast, metadata, body } = resolved;
	const context = createFunctionContext(input, resolved);
	const { operationFacts, stackAnalysis } = analyzeBodyOperations(ast.lines, body, context);
	if (!metadata.import) {
		const facts = analyzeInstruction(ast.functionEndLine, context);
		stackAnalysis.push(toCompiledStackAnalysisLine(ast.functionEndLine, facts, input.functions));
	}
	return { functionId: metadata.id, operationFacts, stackAnalysis, finalStack: cloneStack(context.stack) };
}

export function analyzeStack(input: AnalyzeStackSubProgramInput): StackAnalysisSubProgramReport {
	const functionReports = Object.fromEntries(
		Object.values(input.semanticReferences.functions).map(resolved => {
			const report = analyzeFunction(input, resolved);
			return [report.functionId, report];
		})
	);
	const modules = Object.fromEntries(
		Object.values(input.semanticReferences.modules).map(resolved => [resolved.ast.id, analyzeModule(input, resolved)])
	);
	const usedFunctionIdSet = new Set<string>();
	for (const functionReport of Object.values(functionReports)) {
		if (input.semanticReferences.functions[functionReport.functionId].metadata.exportName) {
			usedFunctionIdSet.add(functionReport.functionId);
		}
		for (const facts of functionReport.operationFacts) {
			if (facts?.targetFunctionId) {
				usedFunctionIdSet.add(facts.targetFunctionId);
			}
		}
	}
	for (const moduleReport of Object.values(modules)) {
		for (const facts of moduleReport.operationFacts) {
			if (facts?.targetFunctionId) {
				usedFunctionIdSet.add(facts.targetFunctionId);
			}
		}
	}
	const functions = Object.fromEntries(
		Object.values(functionReports).map(functionReport => [
			functionReport.functionId,
			{
				...functionReport,
				...(usedFunctionIdSet.has(functionReport.functionId) ? { used: true } : {}),
			},
		])
	);

	return { modules, functions };
}
