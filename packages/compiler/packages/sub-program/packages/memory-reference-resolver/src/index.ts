import type {
	AddressMetadata,
	Argument,
	CompilerASTLine,
	Const,
	ConstantResolutionBlockFacts,
	ConstantResolutionLineFacts,
	ConstantsAST,
	FunctionAST,
	FunctionValueType,
	LocalDeclarationLine,
	LocalMap,
	LocalValueMetadata,
	MemoryPointerMetadataMap,
	MemoryReferenceResolutionBlockFacts,
	MemoryReferenceResolutionLineFacts,
	MemoryReferenceResolutionReport,
	ModuleAST,
	ParamLine,
	ProjectMemoryAliasLookup,
	ProjectMemoryInitializerScope,
	PrototypeAST,
	ResolvedArgumentLiteral,
	ValidatedConstantsAST,
	ValidatedFunctionAST,
	ValidatedModuleAST,
	ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import { ArgumentType, isScalarMemoryDeclarationLine, POINTER_FUNCTION_TYPE_IDENTIFIERS } from '@8f4e/language-spec';
import type { MemoryLayoutPlan, PlannedMemoryModule } from '@8f4e/memory-planner';
import type {
	MemoryReferenceModuleNamespace,
	MemoryReferencePointerMetadataByModuleId,
	MemoryReferenceResolutionContext,
} from './resolveMemoryExpressionOperand';
import { resolveProjectMemoryInitializers } from './resolveProjectMemoryInitializers';
import { tryResolveValueArgument } from './tryResolveValueArgument';

export type {
	MemoryReferenceResolutionBlockFacts,
	MemoryReferenceResolutionLineFacts,
	MemoryReferenceResolutionReport,
} from '@8f4e/language-spec';

export interface MemoryReferenceSubProgramAST<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
> {
	prototypes: readonly TPrototype[];
	modules: readonly TModule[];
	constants: readonly TConstants[];
	functions: readonly TFunction[];
}

export interface ResolveMemoryReferencesInput<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
> {
	ast: MemoryReferenceSubProgramAST<TPrototype, TModule, TConstants, TFunction>;
	memoryPlan: MemoryLayoutPlan;
	memoryAliases: ProjectMemoryAliasLookup;
	projectMemoryInitializerScopes: readonly ProjectMemoryInitializerScope[];
	constantReferences: {
		prototypes: readonly ConstantResolutionBlockFacts[];
		modules: readonly ConstantResolutionBlockFacts[];
		constants: readonly ConstantResolutionBlockFacts[];
		functions: readonly ConstantResolutionBlockFacts[];
	};
}

export interface ResolveMemoryReferencesResult {
	references: MemoryReferenceResolutionReport;
}

function createSubProgramResolutionContext(
	memoryPlan: MemoryLayoutPlan,
	pointerMetadata: MemoryReferencePointerMetadataByModuleId,
	memoryAliases: ProjectMemoryAliasLookup
): MemoryReferenceResolutionContext {
	return {
		memoryPlan,
		memoryAliases,
		pointerMetadata,
		locals: {},
	};
}

function createModuleResolutionContext(
	memoryPlan: MemoryLayoutPlan,
	pointerMetadata: MemoryReferencePointerMetadataByModuleId,
	memoryAliases: ProjectMemoryAliasLookup,
	module: PlannedMemoryModule
): MemoryReferenceResolutionContext {
	return {
		memoryPlan,
		memoryAliases,
		currentModule: module,
		pointerMetadata,
		moduleName: module.id,
		locals: {},
	};
}

const pointerFunctionValueTypes = new Set<string>(POINTER_FUNCTION_TYPE_IDENTIFIERS);

function createPointerLocalBinding(
	type: FunctionValueType
): Extract<LocalValueMetadata, { pointeeBaseType: string }> | undefined {
	if (!pointerFunctionValueTypes.has(type)) {
		return undefined;
	}

	return {
		isInteger: true,
		pointeeBaseType: type.replace(/\*+$/, '') as NonNullable<LocalValueMetadata['pointeeBaseType']>,
		pointerDepth: type.endsWith('**') ? 2 : 1,
	};
}

type FunctionLocalDeclarationLine = ParamLine | LocalDeclarationLine;

function isFunctionLocalDeclarationLine(line: CompilerASTLine): line is FunctionLocalDeclarationLine {
	if (line.instruction !== 'param' && line.instruction !== 'local') {
		return false;
	}

	return true;
}

function collectFunctionLocal(line: CompilerASTLine, locals: LocalMap): void {
	if (!isFunctionLocalDeclarationLine(line)) {
		return;
	}

	const [typeArgument, nameArgument] = line.arguments;
	const pointerLocal = createPointerLocalBinding(typeArgument.value as FunctionValueType);
	if (pointerLocal) {
		locals[nameArgument.value] = pointerLocal;
	}
}

function getPointeeMemoryItem(
	safeRange: NonNullable<AddressMetadata['safeRange']>,
	context: MemoryReferenceResolutionContext
): MemoryReferenceModuleNamespace['memory'][string] | undefined {
	const memoryId = safeRange.memoryId;
	if (!memoryId) {
		return undefined;
	}

	const moduleId = safeRange.moduleId ?? context.moduleName ?? context.currentModule?.id;
	return moduleId ? context.memoryPlan.modules[moduleId]?.memory[memoryId] : undefined;
}

function getPointeeElementCount(
	defaultAddress: AddressMetadata | undefined,
	context: MemoryReferenceResolutionContext
): number | undefined {
	const safeRange = defaultAddress?.safeRange;
	if (!safeRange || safeRange.source !== 'memory-start') {
		return undefined;
	}

	const memoryItem = getPointeeMemoryItem(safeRange, context);
	if (!memoryItem) {
		return undefined;
	}

	const byteOffset = Math.max(0, safeRange.byteAddress - memoryItem.byteAddress);
	return Math.max(0, Math.floor((memoryItem.elementByteLength - byteOffset) / memoryItem.elementWordSize));
}

function updatePointerMemoryMetadata(line: CompilerASTLine, context: MemoryReferenceResolutionContext): void {
	if (!isScalarMemoryDeclarationLine(line)) {
		return;
	}

	const [idArgument, defaultArgument] = line.arguments;
	if (idArgument?.type !== ArgumentType.IDENTIFIER) {
		return;
	}

	const declaration = context.currentModule?.memory[idArgument.value];
	if (!declaration?.pointeeBaseType) {
		return;
	}

	const defaultAddress =
		defaultArgument?.type === ArgumentType.LITERAL ? (defaultArgument as ResolvedArgumentLiteral).address : undefined;
	const pointeeElementCount = getPointeeElementCount(defaultAddress, context);
	const moduleId = context.moduleName ?? context.currentModule?.id;
	if (!moduleId) {
		return;
	}

	if (pointeeElementCount !== undefined) {
		context.pointerMetadata[moduleId]![idArgument.value] = { pointeeElementCount };
	} else {
		delete context.pointerMetadata[moduleId]![idArgument.value];
	}
}

function resolvedValueToLiteral(resolved: Const): ResolvedArgumentLiteral {
	return {
		type: ArgumentType.LITERAL,
		value: resolved.value,
		isInteger: resolved.isInteger,
		...(resolved.isFloat64 ? { isFloat64: true } : {}),
		...(resolved.address ? { address: resolved.address } : {}),
	};
}

function resolveMemoryReferenceArgument(
	argument: Argument,
	context: MemoryReferenceResolutionContext
): Argument | ResolvedArgumentLiteral {
	if (argument.type !== ArgumentType.IDENTIFIER && argument.type !== ArgumentType.COMPILE_TIME_EXPRESSION) {
		return argument;
	}

	const resolved = tryResolveValueArgument(context, argument);
	if (!resolved) {
		return argument;
	}

	return resolvedValueToLiteral(resolved);
}

function resolveMemoryReferenceLineFacts(
	line: CompilerASTLine,
	context: MemoryReferenceResolutionContext,
	initializerDefaults: ReadonlyMap<string, Const> | undefined
): MemoryReferenceResolutionLineFacts | undefined {
	const firstArgument = line.arguments[0];
	const initializer =
		isScalarMemoryDeclarationLine(line) && firstArgument?.type === ArgumentType.IDENTIFIER
			? initializerDefaults?.get(firstArgument.value)
			: undefined;
	if (initializer) return { arguments: [firstArgument!, resolvedValueToLiteral(initializer)] };
	let changed = false;
	const nextArguments = line.arguments.map(argument => {
		const resolved = resolveMemoryReferenceArgument(argument, context);
		if (resolved !== argument) {
			changed = true;
		}
		return resolved;
	});

	return changed ? { arguments: nextArguments } : undefined;
}

function applyConstantFacts<TLine extends CompilerASTLine>(line: TLine, facts?: ConstantResolutionLineFacts): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function applyMemoryReferenceFacts<TLine extends CompilerASTLine>(
	line: TLine,
	facts?: MemoryReferenceResolutionLineFacts
): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function resolveMemoryReferencesInAst(
	ast: PrototypeAST | ModuleAST | ConstantsAST | FunctionAST,
	memoryPlan: MemoryLayoutPlan,
	pointerMetadata: MemoryReferencePointerMetadataByModuleId,
	memoryAliases: ProjectMemoryAliasLookup,
	constantReferences: ConstantResolutionBlockFacts | undefined,
	initializerDefaults: ReadonlyMap<string, Const> | undefined
): MemoryReferenceResolutionBlockFacts {
	const context =
		ast.type === 'module'
			? createModuleResolutionContext(memoryPlan, pointerMetadata, memoryAliases, memoryPlan.modules[ast.id])
			: createSubProgramResolutionContext(memoryPlan, pointerMetadata, memoryAliases);
	const lineFacts = ast.lines.map((line, lineIndex) => {
		const constantResolvedLine = applyConstantFacts(line, constantReferences?.lineFacts[lineIndex]);
		const memoryReferenceFacts = resolveMemoryReferenceLineFacts(constantResolvedLine, context, initializerDefaults);
		const resolvedLine = applyMemoryReferenceFacts(constantResolvedLine, memoryReferenceFacts);
		if (ast.type === 'function') {
			collectFunctionLocal(resolvedLine, context.locals);
		}
		if (ast.type === 'module') {
			updatePointerMemoryMetadata(resolvedLine, context);
		}
		return memoryReferenceFacts;
	});

	return { lineFacts };
}

function resolveDeclarationSourceReferences(
	module: PlannedMemoryModule,
	memoryPlan: MemoryLayoutPlan,
	pointerMetadata: MemoryReferencePointerMetadataByModuleId,
	memoryAliases: ProjectMemoryAliasLookup,
	initializerDefaults: ReadonlyMap<string, Const> | undefined
): MemoryReferenceResolutionBlockFacts {
	pointerMetadata[module.id] = pointerMetadata[module.id] ?? {};
	const context = createModuleResolutionContext(memoryPlan, pointerMetadata, memoryAliases, module);
	const lineFacts = module.declarationSources.map(({ line }) => {
		const memoryReferenceFacts = resolveMemoryReferenceLineFacts(line, context, initializerDefaults);
		updatePointerMemoryMetadata(applyMemoryReferenceFacts(line, memoryReferenceFacts), context);
		return memoryReferenceFacts;
	});

	return { lineFacts };
}

/**
 * Resolves memory-layout value references once for the full sub-program.
 *
 * @param input - Sub-program AST, completed memory layout plan, and constant-resolution facts.
 * @returns Memory-reference facts aligned with the input AST and planned memory declaration sources.
 */
export function resolveMemoryReferences<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
	TConstants extends ConstantsAST = ValidatedConstantsAST,
	TFunction extends FunctionAST = ValidatedFunctionAST,
>(input: ResolveMemoryReferencesInput<TPrototype, TModule, TConstants, TFunction>): ResolveMemoryReferencesResult {
	const pointerMetadata: Record<string, MemoryPointerMetadataMap> = {};
	const declarationSourcesByModuleId: Record<string, MemoryReferenceResolutionBlockFacts> = {};
	const initializerDefaults = resolveProjectMemoryInitializers(
		input.projectMemoryInitializerScopes,
		createSubProgramResolutionContext(input.memoryPlan, pointerMetadata, input.memoryAliases)
	);

	for (const plannedModule of input.memoryPlan.moduleList) {
		declarationSourcesByModuleId[plannedModule.id] = resolveDeclarationSourceReferences(
			plannedModule,
			input.memoryPlan,
			pointerMetadata,
			input.memoryAliases,
			initializerDefaults.get(plannedModule.id)
		);
	}

	return {
		references: {
			prototypes: input.ast.prototypes.map((ast, index) =>
				resolveMemoryReferencesInAst(
					ast,
					input.memoryPlan,
					pointerMetadata,
					input.memoryAliases,
					input.constantReferences.prototypes[index],
					undefined
				)
			),
			modules: input.ast.modules.map((ast, index) =>
				resolveMemoryReferencesInAst(
					ast,
					input.memoryPlan,
					pointerMetadata,
					input.memoryAliases,
					input.constantReferences.modules[index],
					initializerDefaults.get(ast.id)
				)
			),
			constants: input.ast.constants.map((ast, index) =>
				resolveMemoryReferencesInAst(
					ast,
					input.memoryPlan,
					pointerMetadata,
					input.memoryAliases,
					input.constantReferences.constants[index],
					undefined
				)
			),
			functions: input.ast.functions.map((ast, index) =>
				resolveMemoryReferencesInAst(
					ast,
					input.memoryPlan,
					pointerMetadata,
					input.memoryAliases,
					input.constantReferences.functions[index],
					undefined
				)
			),
			declarationSourcesByModuleId,
			pointerMetadataByModuleId: pointerMetadata,
		},
	};
}
