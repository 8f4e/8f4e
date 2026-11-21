import { getError } from '@8f4e/compiler-diagnostics';
import type {
	CompilerASTLine,
	ConstantResolutionBlockFacts,
	ConstantsAST,
	ExecutableInstructionLine,
	FunctionAST,
	FunctionMetadata,
	FunctionRegistry,
	FunctionValueType,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	MemoryReferenceResolutionBlockFacts,
	MemoryReferenceResolutionLineFacts,
	MemoryReferenceResolutionReport,
	ModuleAST,
	ProjectMemoryAliasLookup,
	ReferenceSlotMap,
	RegisteredFunction,
	ResolvedMapLine,
	ResolvedPushLine,
	ResolvedLocalPointerPushLine,
	SemanticReferenceLine,
	SourceLocalBinding,
	ValidatedConstantsAST,
	ValidatedFunctionAST,
	ValidatedModuleAST,
} from '@8f4e/language-spec';
import {
	ArgumentType,
	BlockType,
	EMPTY_REFERENCE_SLOTS,
	ErrorCode,
	functionValueTypeToLocalMetadata,
	getInstructionSpec,
	type InstructionSpec,
	isCodegenInstructionName,
} from '@8f4e/language-spec';
import { createCompilationContext, popBlock, pushBlock, withSourceDiagnostic } from '@8f4e/semantic-utils';
import type { ReferenceResolutionContext } from './context';
import { normalizeOperands } from './normalizeOperands';
import resolveLineReferences from './resolveLineReferences';

export interface SemanticReferenceResolverSubProgramAST<
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
> {
	modules: readonly TModule[];
	constants: readonly TConstants[];
}

export interface ResolveSemanticReferencesInput<
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
> {
	ast: SemanticReferenceResolverSubProgramAST<TModule, TConstants>;
	registeredFunctions: readonly RegisteredFunction<TFunction>[];
	memoryPlan: MemoryLayoutPlan;
	memoryAliases: ProjectMemoryAliasLookup;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	constantReferences: {
		modules: readonly ConstantResolutionBlockFacts[];
		constants: readonly ConstantResolutionBlockFacts[];
		functions: readonly ConstantResolutionBlockFacts[];
	};
	memoryReferences: MemoryReferenceResolutionReport;
	functions: FunctionRegistry;
}

export interface ResolvedOperation {
	/** Provenance only: several executable operations may share one source line. */
	sourceLineIndex: number;
	line: ExecutableInstructionLine;
}

export interface ModuleSemanticReferences<TModule extends ModuleAST = ModuleAST> {
	referenceSlots: ReferenceSlotMap;
	ast: TModule;
	bindings: readonly SourceLocalBinding[];
	body: readonly ResolvedOperation[];
	skipExecutionInCycle: boolean;
}

export interface FunctionSemanticReferences<TFunction extends FunctionAST = FunctionAST> {
	ast: TFunction;
	metadata: FunctionMetadata;
	bindings: readonly SourceLocalBinding[];
	body: readonly ResolvedOperation[];
}

export interface SemanticReferenceReport<
	TModule extends ModuleAST = ModuleAST,
	TFunction extends FunctionAST = FunctionAST,
> {
	modules: Record<string, ModuleSemanticReferences<TModule>>;
	functions: Record<string, FunctionSemanticReferences<TFunction>>;
}

export interface ResolveSemanticReferencesResult<TModule extends ModuleAST, TFunction extends FunctionAST> {
	references: SemanticReferenceReport<TModule, TFunction>;
}

function applyConstantFacts<TLine extends CompilerASTLine>(
	line: TLine,
	facts?: ConstantResolutionBlockFacts['lineFacts'][number]
): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function applyMemoryReferenceFacts<TLine extends CompilerASTLine>(
	line: TLine,
	facts?: MemoryReferenceResolutionLineFacts
): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function applyResolvedArgumentFacts<TLine extends CompilerASTLine>(
	line: TLine,
	constantFacts: ConstantResolutionBlockFacts['lineFacts'][number],
	memoryReferenceFacts: MemoryReferenceResolutionLineFacts | undefined
): TLine {
	return applyMemoryReferenceFacts(applyConstantFacts(line, constantFacts), memoryReferenceFacts);
}

function getPlannedMemoryDeclaration(
	context: ReferenceResolutionContext,
	memoryId: string,
	moduleId = context.namespace.moduleName
) {
	const currentModule = context.currentPlannedModule;
	const module = !moduleId || moduleId === currentModule?.id ? currentModule : context.memoryPlan.modules[moduleId];
	return module?.memory[memoryId];
}

function bindLocal(context: ReferenceResolutionContext, name: string, type: FunctionValueType): void {
	const binding: SourceLocalBinding = {
		id: context.bindings.length,
		name,
		type,
	};
	context.bindings.push(binding);
	context.bindingsByName[name] = binding;
	context.locals[name] = functionValueTypeToLocalMetadata(type);
}

function registerFunctionParameter(
	paramType: FunctionValueType,
	paramName: string,
	line: CompilerASTLine,
	context: ReferenceResolutionContext
): void {
	if (context.locals[paramName] !== undefined) {
		throw getError(ErrorCode.DUPLICATE_PARAMETER_NAME, line, { symbol: context.codeBlockId });
	}
	bindLocal(context, paramName, paramType);
}

function applyLocalLine(line: CompilerASTLine, context: ReferenceResolutionContext): void {
	const typeArg = line.arguments[0] as { value: FunctionValueType };
	const nameArg = line.arguments[1] as { value: string };
	const localName = nameArg.value;

	if (getPlannedMemoryDeclaration(context, localName)) {
		throw getError(ErrorCode.LOCAL_NAME_COLLISION_WITH_MEMORY, line, {
			symbol: context.codeBlockId,
			details: { identifier: localName },
		});
	}

	bindLocal(context, localName, typeArg.value);
}

function applyMapBeginLine(line: CompilerASTLine, context: ReferenceResolutionContext): void {
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

function applyMapLine(line: ResolvedMapLine, context: ReferenceResolutionContext): void {
	const { mapState } = context.activeMapBlock!;
	const key = resolveMapArgumentValue(line.arguments[0]);
	const value = resolveMapArgumentValue(line.arguments[1]);

	mapState.rows.push({
		keyValue: key.value,
		valueValue: value.value,
		valueIsInteger: value.isInteger,
		...(value.isFloat64 ? { valueIsFloat64: true } : {}),
	});
}

function applyResolvedLineEffect(line: SemanticReferenceLine, context: ReferenceResolutionContext): void {
	switch (line.instruction) {
		case 'module': {
			const moduleId = line.arguments[0].value;
			pushBlock(context, { expectedResultTypes: [], blockType: BlockType.MODULE });
			context.namespace.moduleName = moduleId;
			context.codeBlockId = moduleId;
			return;
		}
		case 'moduleEnd':
		case 'functionEnd':
			popBlock(context);
			return;
		case 'function':
			pushBlock(context, { blockType: BlockType.FUNCTION, expectedResultTypes: [] });
			return;
		case 'param': {
			const paramType = line.arguments[0].value as FunctionValueType;
			const paramName = line.arguments[1].value;
			registerFunctionParameter(paramType, paramName, line, context);
			return;
		}
		case 'local':
			applyLocalLine(line, context);
			return;
		case '#loopCap':
			context.loopCap = line.arguments[0].value;
			return;
		case 'mapBegin':
			applyMapBeginLine(line, context);
			return;
		case 'map':
			applyMapLine(line as ResolvedMapLine, context);
			return;
		case 'mapEnd':
			popBlock(context);
			return;
	}
}

function createModuleContext(
	input: ResolveSemanticReferencesInput<ModuleAST, ConstantsAST, FunctionAST>,
	ast: ModuleAST,
	astIndex: number
): ReferenceResolutionContext {
	const plannedModule = input.memoryPlan.modules[ast.id];
	return createCompilationContext<ReferenceResolutionContext>({
		referenceSlots: input.memoryReferences.modules[astIndex]!.referenceSlots,
		namespace: {
			moduleName: undefined,
			functions: input.functions,
		},
		locals: {},
		bindings: [],
		bindingsByName: {},
		stack: [],
		blockStack: [],
		memoryPlan: input.memoryPlan,
		memoryAliases: input.memoryAliases,
		currentPlannedModule: plannedModule,
		pointerMetadataByModuleId: input.pointerMetadataByModuleId,
		mode: 'module',
	});
}

function createFunctionContext(
	input: ResolveSemanticReferencesInput<ModuleAST, ConstantsAST, FunctionAST>,
	functionMetadata: FunctionMetadata
): ReferenceResolutionContext {
	return createCompilationContext<ReferenceResolutionContext>({
		referenceSlots: EMPTY_REFERENCE_SLOTS,
		namespace: {
			moduleName: undefined,
			functions: input.functions,
		},
		locals: {},
		bindings: [],
		bindingsByName: {},
		stack: [],
		blockStack: [],
		memoryPlan: input.memoryPlan,
		memoryAliases: input.memoryAliases,
		pointerMetadataByModuleId: input.pointerMetadataByModuleId,
		mode: 'function',
		currentFunctionMetadata: functionMetadata,
		codeBlockId: functionMetadata.name,
	});
}

function isPointerMemoryIoPush(push: ResolvedPushLine): boolean {
	switch (push.resolvedTarget.kind) {
		case 'memory-pointer':
			return true;
		case 'local-pointer':
			return (push as ResolvedLocalPointerPushLine).arguments[0].dereferenceDepth > 0;
		default:
			return false;
	}
}

function assertFunctionMemoryIoAllowed(line: SemanticReferenceLine, context: ReferenceResolutionContext): void {
	if (context.mode !== 'function' || context.currentFunctionMetadata!.isImpure) return;
	const spec = getInstructionSpec(line.instruction) as InstructionSpec;
	const pointerPush = 'resolvedTarget' in line && isPointerMemoryIoPush(line);
	const inlinePushes = 'expectedPush' in line ? [line.expectedPush] : [];
	const inlinePointerPush = inlinePushes.some(push => 'resolvedTarget' in push && isPointerMemoryIoPush(push));
	if (spec.effects?.memory || pointerPush || inlinePointerPush) {
		throw getError(ErrorCode.IMPURE_DIRECTIVE_REQUIRED_FOR_MEMORY_IO, line, { symbol: context.codeBlockId });
	}
}

function resolveBody(
	lines: readonly CompilerASTLine[],
	context: ReferenceResolutionContext,
	constantReferences: ConstantResolutionBlockFacts | undefined,
	memoryReferences: MemoryReferenceResolutionBlockFacts | undefined
): ResolvedOperation[] {
	const body: ResolvedOperation[] = [];
	for (const [sourceLineIndex, originalLine] of lines.entries()) {
		const sourceLine = applyResolvedArgumentFacts(
			originalLine,
			constantReferences?.lineFacts[sourceLineIndex],
			memoryReferences?.lineFacts[sourceLineIndex]
		);
		withSourceDiagnostic(originalLine, 'semantic references', () => {
			for (const operation of normalizeOperands(sourceLine)) {
				const line = resolveLineReferences(operation, context);
				applyResolvedLineEffect(line, context);
				if (!isCodegenInstructionName(line.instruction)) continue;
				assertFunctionMemoryIoAllowed(line, context);
				body.push({ sourceLineIndex, line: line as ExecutableInstructionLine });
			}
		});
	}
	return body;
}

function resolveModuleReferences<TModule extends ModuleAST>(
	input: ResolveSemanticReferencesInput<ModuleAST, ConstantsAST, FunctionAST>,
	ast: TModule,
	astIndex: number
): [string, ModuleSemanticReferences<TModule>] {
	const context = createModuleContext(input, ast, astIndex);
	const body = resolveBody(
		ast.lines,
		context,
		input.constantReferences.modules[astIndex],
		input.memoryReferences.modules[astIndex]
	);
	return [
		ast.id,
		{
			ast,
			referenceSlots: context.referenceSlots,
			body,
			bindings: context.bindings,
			skipExecutionInCycle: ast.lines.some(line => line.instruction === '#skipExecution'),
		},
	];
}

function resolveFunctionReferences<TFunction extends FunctionAST>(
	input: ResolveSemanticReferencesInput<ModuleAST, ConstantsAST, FunctionAST>,
	declaration: RegisteredFunction<TFunction>,
	astIndex: number
): [string, FunctionSemanticReferences<TFunction>] {
	const { ast, metadata } = declaration;
	const context = createFunctionContext(input, metadata);
	const body = resolveBody(
		ast.lines,
		context,
		input.constantReferences.functions[astIndex],
		input.memoryReferences.functions[astIndex]
	);
	return [metadata.id, { ast, metadata, body, bindings: context.bindings }];
}

/**
 * Resolves semantic references once for the full sub-program.
 *
 * @param input - Sub-program AST and semantic facts produced by earlier compiler passes.
 * @returns Semantic reference facts keyed back to the original sub-program AST.
 */
export function resolveSemanticReferences<
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
>(
	input: ResolveSemanticReferencesInput<TModule, TConstants, TFunction>
): ResolveSemanticReferencesResult<TModule, TFunction> {
	return {
		references: {
			modules: Object.fromEntries(input.ast.modules.map((ast, index) => resolveModuleReferences(input, ast, index))),
			functions: Object.fromEntries(
				input.registeredFunctions.map((declaration, index) => resolveFunctionReferences(input, declaration, index))
			),
		},
	};
}
