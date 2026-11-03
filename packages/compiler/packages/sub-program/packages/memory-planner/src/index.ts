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
	PrototypeAST,
	ScalarMemoryDeclarationLine,
	ShapeLine,
	ValidatedModuleAST,
	ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import {
	ALLOCATION_UNIT_BYTE_SIZE,
	ArgumentType,
	ErrorCode,
	type ErrorCodeValue,
	getError,
	isArrayMemoryDeclarationLine,
	isBinaryCompileTimeExpression,
	isMemoryDeclarationLine,
	isScalarMemoryDeclarationLine,
} from '@8f4e/language-spec';
import { planArrayDeclarationLayout, planScalarDeclarationLayout } from './declarations';
import { getAllocatedByteLength, getEndAddressSafeByteLength, getEndByteAddress } from './layoutAddresses';

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

export class MemoryPlannerError extends Error {
	readonly compilerErrorCode: ErrorCodeValue;
	readonly line: CompilerASTLine;
	readonly details?: MemoryPlannerErrorDetails;

	constructor(
		compilerErrorCode: ErrorCodeValue,
		line: CompilerASTLine,
		message: string,
		details?: MemoryPlannerErrorDetails
	) {
		super(message);
		this.name = 'MemoryPlannerError';
		this.compilerErrorCode = compilerErrorCode;
		this.line = line;
		this.details = details;
	}
}

interface MemoryLayoutSourcePrototype {
	id: string;
	declarationLines: readonly MemoryDeclarationLine[];
}

type MemoryLayoutSourceLine = MemoryDeclarationLine | ShapeLine;

interface MemoryLayoutSourceModule {
	id: string;
	moduleLine: Pick<ModuleLine, 'lineNumber'>;
	lines: readonly MemoryLayoutSourceLine[];
}

interface MemoryLayoutPlanInput {
	prototypes: readonly MemoryLayoutSourcePrototype[];
	modules: readonly MemoryLayoutSourceModule[];
	startingByteAddress?: number;
}

export interface SubProgramMemoryLayoutPlanInput<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
> {
	prototypes: readonly TPrototype[];
	modules: readonly TModule[];
	constantReferences: {
		prototypes: readonly ConstantResolutionBlockFacts[];
		modules: readonly ConstantResolutionBlockFacts[];
	};
	startingByteAddress?: number;
}

function plannerError(
	compilerErrorCode: ErrorCodeValue,
	line: CompilerASTLine,
	message = getError(compilerErrorCode, line).message,
	details?: MemoryPlannerErrorDetails
): MemoryPlannerError {
	return new MemoryPlannerError(compilerErrorCode, line, message, details);
}

function getScalarDeclarationId(line: ScalarMemoryDeclarationLine): string {
	const firstArgument = line.arguments[0];
	if (firstArgument?.type === ArgumentType.IDENTIFIER && firstArgument.referenceKind === 'plain') {
		return firstArgument.value;
	}

	return '__anonymous__' + line.lineNumber;
}

function getPrototypeMap(
	prototypes: readonly MemoryLayoutSourcePrototype[]
): Readonly<Record<string, MemoryLayoutSourcePrototype>> {
	return Object.fromEntries(prototypes.map(prototype => [prototype.id, prototype]));
}

function applyConstantFacts<TLine extends CompilerASTLine>(line: TLine, facts?: ConstantResolutionLineFacts): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function getPrototypeSources(
	prototypes: readonly PrototypeAST[],
	constantReferences: readonly ConstantResolutionBlockFacts[]
): MemoryLayoutSourcePrototype[] {
	const seenPrototypeIds = new Set<string>();

	return prototypes.map((prototype, prototypeIndex) => {
		if (seenPrototypeIds.has(prototype.id)) {
			throw plannerError(
				ErrorCode.DUPLICATE_IDENTIFIER,
				prototype.prototypeLine,
				`Duplicate prototype shape id: ${prototype.id}`,
				{ identifier: prototype.id }
			);
		}
		seenPrototypeIds.add(prototype.id);
		const blockFacts = constantReferences[prototypeIndex];

		return {
			id: prototype.id,
			declarationLines: prototype.lines
				.map((sourceLine, lineIndex) => {
					const line = applyConstantFacts(sourceLine, blockFacts?.lineFacts[lineIndex]);
					return isMemoryDeclarationLine(line) ? normalizeLayoutMemoryDeclarationLine(line, sourceLine) : line;
				})
				.filter(isMemoryDeclarationLine),
		};
	});
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

function isShapeLine(line: CompilerASTLine): line is ShapeLine {
	return line.instruction === 'shape';
}

function collectModuleMemoryLayoutSourceLines(
	ast: ModuleAST,
	constantReferences: ConstantResolutionBlockFacts | undefined
): MemoryLayoutSourceModule {
	const lines: MemoryLayoutSourceLine[] = [];

	for (let lineIndex = 0; lineIndex < ast.lines.length; lineIndex++) {
		const sourceLine = ast.lines[lineIndex];
		const line = applyConstantFacts(sourceLine, constantReferences?.lineFacts[lineIndex]);

		if (isMemoryDeclarationLine(line)) {
			lines.push(normalizeLayoutMemoryDeclarationLine(line, sourceLine));
			continue;
		}

		if (isShapeLine(line)) {
			lines.push(line);
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

function getEffectiveMemoryDeclarationSources(
	sourceModule: MemoryLayoutSourceModule,
	prototypesById: Readonly<Record<string, MemoryLayoutSourcePrototype>>
): PlannedMemoryDeclarationSource[] {
	const declarationSources: PlannedMemoryDeclarationSource[] = [];

	for (const line of sourceModule.lines) {
		if (isMemoryDeclarationLine(line)) {
			declarationSources.push({ line, isInherited: false });
			continue;
		}

		const prototypeId = line.arguments[0].value;
		const prototype = prototypesById[prototypeId];
		if (!prototype) {
			throw plannerError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unknown prototype shape in memory layout.', {
				identifier: prototypeId,
			});
		}

		for (const declarationLine of prototype.declarationLines) {
			declarationSources.push({
				line: {
					...declarationLine,
					lineNumber: line.lineNumber,
				},
				isInherited: true,
			});
		}
	}

	return declarationSources;
}

function planDeclarationLine(
	line: MemoryDeclarationLine,
	startingByteAddress: number,
	localAllocationUnitOffset: number
) {
	if (isScalarMemoryDeclarationLine(line)) {
		return planScalarDeclarationLayout({
			id: getScalarDeclarationId(line),
			lineNumber: line.lineNumber,
			instruction: line.instruction,
			startingByteAddress,
			localAllocationUnitOffset,
		});
	}

	const elementCountArgument = line.arguments[1] as { value: number };
	return planArrayDeclarationLayout({
		id: line.arguments[0].value,
		lineNumber: line.lineNumber,
		instruction: line.instruction,
		numberOfElements: elementCountArgument.value,
		startingByteAddress,
		localAllocationUnitOffset,
	});
}

function planModuleMemory(
	sourceModule: MemoryLayoutSourceModule,
	moduleByteAddress: number,
	prototypesById: Readonly<Record<string, MemoryLayoutSourcePrototype>>
): Omit<
	PlannedMemoryModule,
	'byteAddress' | 'id' | 'lineNumber' | 'allocatedByteLength' | 'endByteAddress' | 'endAddressSafeByteLength'
> {
	let localAllocationUnitOffset = 0;
	const memory: Record<string, PlannedMemoryDeclaration> = {};
	const declarations: PlannedMemoryDeclaration[] = [];
	const declarationSources = getEffectiveMemoryDeclarationSources(sourceModule, prototypesById);

	for (const declarationSource of declarationSources) {
		const plannedDeclaration = planDeclarationLine(
			declarationSource.line,
			moduleByteAddress,
			localAllocationUnitOffset
		);
		const declaration = plannedDeclaration.declaration;

		memory[declaration.id] = declaration;
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
	const prototypesById = getPrototypeMap(input.prototypes);
	let nextByteAddress = startingByteAddress;
	const modules: Record<string, PlannedMemoryModule> = {};
	const moduleList: PlannedMemoryModule[] = [];

	for (const sourceModule of [...input.modules].sort((left, right) =>
		left.id < right.id ? -1 : left.id > right.id ? 1 : 0
	)) {
		const moduleByteAddress = nextByteAddress;
		const moduleMemory = planModuleMemory(sourceModule, moduleByteAddress, prototypesById);
		const plannedModule: PlannedMemoryModule = {
			id: sourceModule.id,
			lineNumber: sourceModule.moduleLine.lineNumber,
			byteAddress: moduleByteAddress,
			allocationUnitCount: moduleMemory.allocationUnitCount,
			allocatedByteLength: getAllocatedByteLength(moduleMemory.allocationUnitCount),
			endByteAddress: getEndByteAddress(moduleByteAddress, moduleMemory.allocationUnitCount),
			endAddressSafeByteLength: getEndAddressSafeByteLength(moduleMemory.allocationUnitCount),
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
export function planSubProgramMemoryLayout<
	TPrototype extends PrototypeAST = ValidatedPrototypeAST,
	TModule extends ModuleAST = ValidatedModuleAST,
>(input: SubProgramMemoryLayoutPlanInput<TPrototype, TModule>): MemoryLayoutPlan {
	return planMemoryLayout({
		prototypes: getPrototypeSources(input.prototypes, input.constantReferences.prototypes),
		modules: createMemoryLayoutSourceModules(input.modules, input.constantReferences.modules),
		startingByteAddress: input.startingByteAddress ?? ALLOCATION_UNIT_BYTE_SIZE,
	});
}
