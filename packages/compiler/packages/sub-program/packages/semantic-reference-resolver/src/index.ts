import type {
	CompilerASTLine,
	ConstantResolutionBlockFacts,
	ConstantsAST,
	ExecutableInstructionLine,
	FunctionAST,
	FunctionMetadata,
	FunctionRegistry,
	FunctionTypeRegistry,
	FunctionValueType,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	MemoryReferenceResolutionBlockFacts,
	MemoryReferenceResolutionLineFacts,
	MemoryReferenceResolutionReport,
	ModuleAST,
	ProjectMemoryAliasLookup,
	PrototypeAST,
	RegisteredFunction,
	ResolvedMapLine,
	SemanticReferenceLine,
	SourceLocalBinding,
	ValidatedConstantsAST,
	ValidatedFunctionAST,
	ValidatedModuleAST,
	ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import {
	ArgumentType,
	BlockType,
	compilerSourceBlockInstructionByType,
	ErrorCode,
	functionValueTypeToLocalMetadata,
	getError,
	getInstructionSpec,
	type InstructionSpec,
	isCodegenInstructionName,
	isSemanticInstructionLine,
} from '@8f4e/language-spec';
import { createCompilationContext, popBlock, pushBlock, withSourceDiagnostic } from '@8f4e/semantic-utils';
import type { ReferenceResolutionContext } from './context';
import { normalizeOperands } from './normalizeOperands';
import resolveLineReferences from './resolveLineReferences';

const moduleBlockType = compilerSourceBlockInstructionByType.module.type;

export interface SemanticReferenceResolverSubProgramAST<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
> {
	prototypes: readonly TPrototype[];
	modules: readonly TModule[];
	constants: readonly TConstants[];
}

export interface ResolveSemanticReferencesInput<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
> {
	ast: SemanticReferenceResolverSubProgramAST<TPrototype, TModule, TConstants>;
	registeredFunctions: readonly RegisteredFunction<TFunction>[];
	memoryPlan: MemoryLayoutPlan;
	memoryAliases: ProjectMemoryAliasLookup;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	constantReferences: {
		prototypes: readonly ConstantResolutionBlockFacts[];
		modules: readonly ConstantResolutionBlockFacts[];
		constants: readonly ConstantResolutionBlockFacts[];
		functions: readonly ConstantResolutionBlockFacts[];
	};
	memoryReferences: MemoryReferenceResolutionReport;
	functions: FunctionRegistry;
	functionTypeRegistry: FunctionTypeRegistry;
	prototypeShapes: Readonly<Record<string, TPrototype>>;
}

export interface ResolvedOperation {
	/** Provenance only: several executable operations may share one source line. */
	sourceLineIndex: number;
	line: ExecutableInstructionLine;
}

export interface ModuleSemanticReferences<TModule extends ModuleAST = ModuleAST> {
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

function collectPrototypeShapeIds(ast: ModuleAST): string[] {
	const prototypeShapeIds: string[] = [];
	for (const line of ast.lines) {
		if (line.instruction !== 'shape') {
			continue;
		}
		const prototypeId = line.arguments[0].value;
		if (!prototypeShapeIds.includes(prototypeId)) {
			prototypeShapeIds.push(prototypeId);
		}
	}
	return prototypeShapeIds;
}

function applySemanticLine(line: CompilerASTLine, context: ReferenceResolutionContext): void {
	if (!isSemanticInstructionLine(line)) {
		return;
	}

	switch (line.instruction) {
		case 'const':
		case 'use':
			return;
		case 'module': {
			const moduleId = line.arguments[0].value;
			pushBlock(context, { expectedResultTypes: [], blockType: BlockType.MODULE });
			context.namespace.moduleName = moduleId;
			context.codeBlockId = moduleId;
			context.codeBlockType = moduleBlockType;
			return;
		}
		case 'moduleEnd':
			popBlock(context);
			return;
		case 'shape': {
			const prototypeId = line.arguments[0].value;
			if (!context.namespace.prototypeShapeIds.includes(prototypeId)) {
				context.namespace.prototypeShapeIds.push(prototypeId);
			}
			return;
		}
	}
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

function bindLocal(
	context: ReferenceResolutionContext,
	name: string,
	type: FunctionValueType,
	parameterIndex?: number
): void {
	const binding: SourceLocalBinding = {
		id: context.bindings.length,
		name,
		type,
		...(parameterIndex !== undefined ? { parameterIndex } : {}),
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
		throw getError(ErrorCode.DUPLICATE_PARAMETER_NAME, line, context);
	}
	bindLocal(context, paramName, paramType, context.bindings.length);
}

function applyParamShapeLine(line: CompilerASTLine, context: ReferenceResolutionContext): void {
	const expansion = context.currentFunctionMetadata!.paramShapeExpansions!.find(
		expansion => expansion.lineNumber === line.lineNumber
	)!;

	for (const parameter of expansion.parameters) {
		registerFunctionParameter(parameter.type, parameter.name, line, context);
	}
}

function applyLocalLine(line: CompilerASTLine, context: ReferenceResolutionContext): void {
	const typeArg = line.arguments[0] as { value: FunctionValueType };
	const nameArg = line.arguments[1] as { value: string };
	const localName = nameArg.value;

	if (getPlannedMemoryDeclaration(context, localName)) {
		throw getError(ErrorCode.LOCAL_NAME_COLLISION_WITH_MEMORY, line, context, { identifier: localName });
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
		case 'module':
		case 'moduleEnd':
		case 'shape':
			applySemanticLine(line, context);
			return;
		case 'function':
			pushBlock(context, { blockType: BlockType.FUNCTION, expectedResultTypes: [] });
			return;
		case 'functionEnd':
			popBlock(context);
			return;
		case 'param': {
			const paramType = line.arguments[0].value as FunctionValueType;
			const paramName = line.arguments[1].value;
			registerFunctionParameter(paramType, paramName, line, context);
			return;
		}
		case 'paramShape':
			applyParamShapeLine(line, context);
			return;
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
	input: ResolveSemanticReferencesInput<PrototypeAST, ModuleAST, ConstantsAST, FunctionAST>,
	ast: ModuleAST
): ReferenceResolutionContext {
	const plannedModule = input.memoryPlan.modules[ast.id];
	return createCompilationContext<ReferenceResolutionContext>({
		namespace: {
			moduleName: undefined,
			functions: input.functions,
			prototypeShapeIds: collectPrototypeShapeIds(ast),
		},
		locals: {},
		bindings: [],
		bindingsByName: {},
		byteCode: [],
		stack: [],
		blockStack: [],
		memoryPlan: input.memoryPlan,
		memoryAliases: input.memoryAliases,
		currentPlannedModule: plannedModule,
		pointerMetadataByModuleId: input.pointerMetadataByModuleId,
		mode: 'module',
		functionTypeRegistry: input.functionTypeRegistry,
		prototypeShapes: input.prototypeShapes,
		projectBlockId: ast.projectBlockId,
		source: ast.source,
	});
}

function createFunctionContext(
	input: ResolveSemanticReferencesInput<PrototypeAST, ModuleAST, ConstantsAST, FunctionAST>,
	ast: FunctionAST,
	functionMetadata: FunctionMetadata
): ReferenceResolutionContext {
	return createCompilationContext<ReferenceResolutionContext>({
		namespace: {
			moduleName: undefined,
			functions: input.functions,
			prototypeShapeIds: [],
		},
		locals: {},
		bindings: [],
		bindingsByName: {},
		byteCode: [],
		stack: [],
		blockStack: [],
		memoryPlan: input.memoryPlan,
		memoryAliases: input.memoryAliases,
		pointerMetadataByModuleId: input.pointerMetadataByModuleId,
		mode: 'function',
		codeBlockType: 'function',
		projectBlockId: ast.projectBlockId,
		source: ast.source,
		currentFunctionId: functionMetadata.id,
		currentFunctionName: functionMetadata.name,
		currentFunctionMetadata: functionMetadata,
		codeBlockId: functionMetadata.name,
		functionTypeRegistry: input.functionTypeRegistry,
		prototypeShapes: input.prototypeShapes,
	});
}

function assertFunctionMemoryIoAllowed(line: SemanticReferenceLine, context: ReferenceResolutionContext): void {
	if (context.mode !== 'function' || context.currentFunctionMetadata!.isImpure) return;
	const spec = getInstructionSpec(line.instruction) as InstructionSpec;
	const pointerPush =
		'resolvedTarget' in line &&
		(line.resolvedTarget.kind === 'local-pointer' || line.resolvedTarget.kind === 'memory-pointer');
	const inlinePushes = 'expectedPush' in line ? [line.expectedPush] : [];
	const inlinePointerPush = inlinePushes.some(
		push =>
			'resolvedTarget' in push &&
			(push.resolvedTarget.kind === 'local-pointer' || push.resolvedTarget.kind === 'memory-pointer')
	);
	if (spec.effects?.memory || pointerPush || inlinePointerPush) {
		throw getError(ErrorCode.IMPURE_DIRECTIVE_REQUIRED_FOR_MEMORY_IO, line, context);
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
		withSourceDiagnostic(originalLine, () => {
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
	input: ResolveSemanticReferencesInput<PrototypeAST, ModuleAST, ConstantsAST, FunctionAST>,
	ast: TModule,
	astIndex: number
): [string, ModuleSemanticReferences<TModule>] {
	const context = createModuleContext(input, ast);
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
			body,
			bindings: context.bindings,
			skipExecutionInCycle: ast.lines.some(line => line.instruction === '#skipExecution'),
		},
	];
}

function resolveFunctionReferences<TFunction extends FunctionAST>(
	input: ResolveSemanticReferencesInput<PrototypeAST, ModuleAST, ConstantsAST, FunctionAST>,
	declaration: RegisteredFunction<TFunction>,
	astIndex: number
): [string, FunctionSemanticReferences<TFunction>] {
	const { ast, metadata } = declaration;
	const context = createFunctionContext(input, ast, metadata);
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
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
>(
	input: ResolveSemanticReferencesInput<TPrototype, TModule, TConstants, TFunction>
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
