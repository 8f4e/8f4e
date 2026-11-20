import { CompilerError, getError } from '@8f4e/compiler-diagnostics';
import type {
	Argument,
	CompilerASTLine,
	ConstantResolutionBlockFacts,
	ConstantResolutionLineFacts,
	MemoryDeclarationLine,
	MemoryLayoutPlan,
	ModuleAST,
	ModuleLine,
	PlannedMemoryDeclaration,
	PlannedMemoryDeclarationSource,
	PlannedMemoryModule,
	ValidatedModuleAST,
} from '@8f4e/language-spec';
import {
	ALLOCATION_UNIT_BYTE_SIZE,
	ArgumentType,
	ErrorCode,
	type ErrorCodeValue,
	isArrayMemoryDeclarationLine,
	isBinaryCompileTimeExpression,
	isMemoryDeclarationLine,
	isScalarMemoryDeclarationLine,
} from '@8f4e/language-spec';
import { planArrayDeclarationLayout, planScalarDeclarationLayout } from './declarations';
import { getAllocatedByteLength, getEndByteAddress } from './layoutAddresses';

export type {
	MemoryLayoutPlan,
	PlannedMemoryDeclaration,
	PlannedMemoryDeclarationSource,
	PlannedMemoryModule,
} from '@8f4e/language-spec';

interface MemoryPlannerErrorDetails {
	identifier?: string;
	reason?: string;
}

interface MemoryLayoutSourceModule {
	id: string;
	moduleLine: Pick<ModuleLine, 'lineNumber'>;
	lines: readonly MemoryDeclarationLine[];
}

interface MemoryLayoutPlanInput {
	modules: readonly MemoryLayoutSourceModule[];
	startingByteAddress?: number;
}

export interface SubProgramMemoryLayoutPlanInput<TModule extends ModuleAST = ValidatedModuleAST> {
	modules: readonly TModule[];
	constantReferences: {
		modules: readonly ConstantResolutionBlockFacts[];
	};
	startingByteAddress?: number;
}

function plannerError(
	compilerErrorCode: ErrorCodeValue,
	line: CompilerASTLine,
	message?: string,
	details?: MemoryPlannerErrorDetails
) {
	const error = getError(compilerErrorCode, line, { details: details });
	return message ? new CompilerError({ ...error.diagnostic, message }) : error;
}

function getDeclarationName(line: MemoryDeclarationLine): string | undefined {
	if (isArrayMemoryDeclarationLine(line)) return line.arguments[0].value;
	const firstArgument = line.arguments[0];
	if (firstArgument?.type === ArgumentType.IDENTIFIER && firstArgument.referenceKind === 'plain') {
		return firstArgument.value;
	}
}

function applyConstantFacts<TLine extends CompilerASTLine>(line: TLine, facts?: ConstantResolutionLineFacts): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function getUnresolvedArgumentIdentifier(argument: Argument): string {
	if (argument.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
		const expression = isBinaryCompileTimeExpression(argument)
			? `${argument.left.value}${argument.operator}${argument.right.value}`
			: String(argument.left.value);
		return argument.rounding ? `${argument.rounding}(${expression})` : expression;
	}

	return argument.type === ArgumentType.IDENTIFIER ? argument.value : String(argument.type);
}

function normalizeLayoutMemoryDeclarationLine(
	line: MemoryDeclarationLine,
	sourceLine: CompilerASTLine = line
): MemoryDeclarationLine {
	if (!isArrayMemoryDeclarationLine(line)) {
		return line;
	}

	const elementCount = line.arguments[1];
	if (elementCount.type !== ArgumentType.LITERAL) {
		throw plannerError(ErrorCode.UNDECLARED_IDENTIFIER, sourceLine, 'Unable to resolve memory declaration size.', {
			identifier: getUnresolvedArgumentIdentifier(elementCount),
		});
	}

	if (!Number.isInteger(elementCount.value) || elementCount.value < 0) {
		throw plannerError(ErrorCode.INVALID_ARRAY_SIZE, sourceLine);
	}

	return elementCount === line.arguments[1]
		? line
		: ({
				...line,
				arguments: [line.arguments[0], elementCount, ...line.arguments.slice(2)],
			} as MemoryDeclarationLine);
}

function collectModuleMemoryLayoutSourceLines(
	ast: ModuleAST,
	constantReferences: ConstantResolutionBlockFacts | undefined
): MemoryLayoutSourceModule {
	const lines: MemoryDeclarationLine[] = [];

	for (let lineIndex = 0; lineIndex < ast.lines.length; lineIndex++) {
		const sourceLine = ast.lines[lineIndex];
		const line = applyConstantFacts(sourceLine, constantReferences?.lineFacts[lineIndex]);

		if (isMemoryDeclarationLine(line)) {
			lines.push(normalizeLayoutMemoryDeclarationLine(line, sourceLine));
		}
	}

	return {
		id: ast.id,
		moduleLine: ast.moduleLine,
		lines,
	};
}

function createMemoryLayoutSourceModules(
	asts: readonly ModuleAST[],
	constantReferences: readonly ConstantResolutionBlockFacts[]
): MemoryLayoutSourceModule[] {
	return asts.map((ast, index) => collectModuleMemoryLayoutSourceLines(ast, constantReferences[index]));
}

function planDeclarationLine(
	line: MemoryDeclarationLine,
	startingByteAddress: number,
	localAllocationUnitOffset: number
) {
	if (isScalarMemoryDeclarationLine(line)) {
		return planScalarDeclarationLayout({
			lineNumber: line.lineNumber,
			instruction: line.instruction,
			startingByteAddress,
			localAllocationUnitOffset,
		});
	}

	const elementCountArgument = line.arguments[1] as { value: number };
	return planArrayDeclarationLayout({
		lineNumber: line.lineNumber,
		instruction: line.instruction,
		numberOfElements: elementCountArgument.value,
		startingByteAddress,
		localAllocationUnitOffset,
	});
}

function planModuleMemory(
	sourceModule: MemoryLayoutSourceModule,
	moduleByteAddress: number
): Omit<PlannedMemoryModule, 'byteAddress' | 'id' | 'lineNumber' | 'allocatedByteLength' | 'endByteAddress'> {
	let localAllocationUnitOffset = 0;
	const memory: Record<string, PlannedMemoryDeclaration> = {};
	const declarations: PlannedMemoryDeclaration[] = [];
	const declarationSources: PlannedMemoryDeclarationSource[] = sourceModule.lines.map(line => ({ line }));

	for (const { line } of declarationSources) {
		const plannedDeclaration = planDeclarationLine(line, moduleByteAddress, localAllocationUnitOffset);
		const name = getDeclarationName(line);
		const declaration = {
			...plannedDeclaration.declaration,
			id: declarations.length,
			...(name !== undefined ? { name } : {}),
		};

		if (name !== undefined) memory[name] = declaration;
		declarations.push(declaration);
		localAllocationUnitOffset = plannedDeclaration.nextLocalAllocationUnitOffset;
	}

	return {
		allocationUnitCount: localAllocationUnitOffset,
		memory,
		declarations,
		declarationSources,
	};
}

/** Plans module and declaration memory addresses from internal planner-ready source. */
function planMemoryLayout(input: MemoryLayoutPlanInput): MemoryLayoutPlan {
	const startingByteAddress = input.startingByteAddress ?? ALLOCATION_UNIT_BYTE_SIZE;
	let nextByteAddress = startingByteAddress;
	const modules: Record<string, PlannedMemoryModule> = {};
	const moduleList: PlannedMemoryModule[] = [];

	for (const sourceModule of [...input.modules].sort((left, right) =>
		left.id < right.id ? -1 : left.id > right.id ? 1 : 0
	)) {
		const moduleByteAddress = nextByteAddress;
		const moduleMemory = planModuleMemory(sourceModule, moduleByteAddress);
		const plannedModule: PlannedMemoryModule = {
			id: sourceModule.id,
			lineNumber: sourceModule.moduleLine.lineNumber,
			byteAddress: moduleByteAddress,
			allocationUnitCount: moduleMemory.allocationUnitCount,
			allocatedByteLength: getAllocatedByteLength(moduleMemory.allocationUnitCount),
			endByteAddress: getEndByteAddress(moduleByteAddress, moduleMemory.allocationUnitCount),
			memory: moduleMemory.memory,
			declarations: moduleMemory.declarations,
			declarationSources: moduleMemory.declarationSources,
		};

		modules[plannedModule.id] = plannedModule;
		moduleList.push(plannedModule);
		nextByteAddress = moduleByteAddress + plannedModule.allocatedByteLength;
	}

	return {
		modules,
		moduleList,
	};
}

/**
 * Builds planner-ready source from validated sub-program ASTs and plans module memory layout.
 * Constant references are supplied as pass facts, so array declaration counts
 * must already be resolved literals when they reach this pass.
 *
 * @param input - Validated sub-program ASTs plus optional layout settings.
 * @returns Address and size metadata for modules and memory declarations.
 */
export function planSubProgramMemoryLayout<TModule extends ModuleAST = ValidatedModuleAST>(
	input: SubProgramMemoryLayoutPlanInput<TModule>
): MemoryLayoutPlan {
	return planMemoryLayout({
		modules: createMemoryLayoutSourceModules(input.modules, input.constantReferences.modules),
		startingByteAddress: input.startingByteAddress ?? ALLOCATION_UNIT_BYTE_SIZE,
	});
}
