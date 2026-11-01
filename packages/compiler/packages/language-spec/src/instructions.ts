import type {
	InstructionPlacement,
	InstructionSpec,
	SourceBlockCompilationMode,
	SourceBlockPlacement,
} from './instructionSpecs';
import { getInstructionSpec, instructionSpecs } from './instructionSpecs';
import type {
	CodegenInstructionSpecName,
	InstructionSpecName,
	NonCodegenInstructionSpecName,
	SourceInstructionSpecName,
} from './instructionSpecTypes';
import type { MemoryDeclarationInstruction } from './memory';
import { memoryDeclarationInstructions } from './memory';
import type { ProjectInstructionName } from './project';
import { projectInstructionNames } from './project';

type InstructionSpecEntry = readonly [InstructionSpecName, InstructionSpec];

type InstructionBlockSpec = NonNullable<InstructionPlacement['block']>;
type InstructionBlockFor<Instruction extends InstructionSpecName> = (typeof instructionSpecs)[Instruction] extends {
	placement: { block: infer Block };
}
	? Block
	: never;
type InstructionsByBlockRole<Role extends InstructionBlockSpec['role']> = {
	[Instruction in InstructionSpecName]: InstructionBlockFor<Instruction> extends { role: Role } ? Instruction : never;
}[InstructionSpecName];
type SourceBlockStartInstruction = {
	[Instruction in InstructionSpecName]: InstructionBlockFor<Instruction> extends {
		role: 'start';
		sourceBlock: object;
	}
		? Instruction
		: never;
}[InstructionSpecName];
type SourceBlockKindFor<Instruction extends InstructionSpecName> =
	InstructionBlockFor<Instruction> extends {
		kind: infer Kind;
	}
		? Extract<Kind, SourceBlockPlacement>
		: never;
type SourceBlockMetadataFor<Instruction extends InstructionSpecName> =
	InstructionBlockFor<Instruction> extends {
		sourceBlock: infer Metadata;
	}
		? Metadata
		: never;
type FunctionDeclarationInstructionsByFlag<Flag extends 'preBody' | 'importedFunction'> = {
	[Instruction in InstructionSpecName]: (typeof instructionSpecs)[Instruction] extends {
		functionDeclaration: { [Key in Flag]: true };
	}
		? Instruction
		: never;
}[InstructionSpecName];

const instructionSpecEntries = Object.entries(instructionSpecs) as InstructionSpecEntry[];

function getInstructionBlock(spec: InstructionSpec): InstructionBlockSpec | undefined {
	return spec.placement?.block;
}

function getBlockEndInstruction(block: InstructionBlockSpec): BlockEndInstruction {
	return instructionSpecEntries.find(([, spec]) => {
		const candidateBlock = getInstructionBlock(spec);
		return candidateBlock?.kind === block.kind && candidateBlock.role === 'end';
	})?.[0] as BlockEndInstruction;
}

export type SemanticInstructionName = Extract<NonCodegenInstructionSpecName, SourceInstructionSpecName>;
export const semanticInstructionNames = instructionSpecEntries
	.filter(([, spec]) => spec.sourceInstruction !== false && spec.codegen === false)
	.map(([instruction]) => instruction) as SemanticInstructionName[];

export type BlockStartInstruction = InstructionsByBlockRole<'start'>;
export type BlockEndInstruction = InstructionsByBlockRole<'end'>;

export const compilerBlockInstructionPairs = instructionSpecEntries.flatMap(([start, spec]) => {
	const block = getInstructionBlock(spec);
	if (block?.role !== 'start') {
		return [];
	}

	return [{ start: start as BlockStartInstruction, end: getBlockEndInstruction(block) }];
});

export const stackBlockInstructionPairs = compilerBlockInstructionPairs.filter(({ start }) => {
	const block = getInstructionBlock(getInstructionSpec(start) as InstructionSpec);
	return block?.role === 'start' && block.stackBlock === true;
});

export const blockStartInstructions = compilerBlockInstructionPairs.map(
	({ start }) => start
) as BlockStartInstruction[];

export const blockEndToStartInstruction = Object.fromEntries(
	compilerBlockInstructionPairs.map(({ start, end }) => [end, start])
) as Record<BlockEndInstruction, BlockStartInstruction>;

type CompilerSourceBlockInstructionPair = {
	[Instruction in SourceBlockStartInstruction]: {
		readonly type: SourceBlockKindFor<Instruction>;
		readonly start: Instruction;
		readonly end: BlockEndInstruction;
		readonly compilesToModule: SourceBlockMetadataFor<Instruction> extends {
			compilesToModule: infer Compiles extends boolean;
		}
			? Compiles
			: never;
		readonly compilationMode: SourceBlockMetadataFor<Instruction> extends {
			compilationMode: infer Mode extends SourceBlockCompilationMode;
		}
			? Mode
			: never;
	};
}[SourceBlockStartInstruction];

export type CompilerSourceBlockType = CompilerSourceBlockInstructionPair['type'];
export type CompilerSourceCompilationMode = Exclude<CompilerSourceBlockInstructionPair['compilationMode'], null>;

export const compilerSourceBlockInstructionPairs = compilerBlockInstructionPairs.flatMap(({ start, end }) => {
	const block = getInstructionBlock(getInstructionSpec(start) as InstructionSpec);
	if (block?.role !== 'start' || !block.sourceBlock) {
		return [];
	}

	return [
		{
			type: block.kind as SourceBlockPlacement,
			start: start as SourceBlockStartInstruction,
			end,
			compilesToModule: block.sourceBlock.compilesToModule,
			compilationMode: block.sourceBlock.compilationMode,
		},
	];
}) as CompilerSourceBlockInstructionPair[];

export const compilerSourceBlockInstructionByType = Object.fromEntries(
	compilerSourceBlockInstructionPairs.map(pair => [pair.type, pair])
) as {
	readonly [Type in CompilerSourceBlockType]: Extract<
		(typeof compilerSourceBlockInstructionPairs)[number],
		{ type: Type }
	>;
};

const documentOnlyBlockInstructionPairs = [
	{ type: 'note', start: 'note', end: 'noteEnd' },
	{ type: 'includes', start: 'includes', end: 'includesEnd' },
] as const;
const documentOnlyLineInstructionNames = ['include'] as const;

export const documentOnlyInstructionNames = [
	...documentOnlyBlockInstructionPairs.flatMap(({ start, end }) => [start, end]),
	...documentOnlyLineInstructionNames,
] as const;
export type DocumentOnlyInstructionName = (typeof documentOnlyInstructionNames)[number];

export const documentBlockInstructionPairs = [
	...compilerSourceBlockInstructionPairs,
	...documentOnlyBlockInstructionPairs,
] as const;

export type DocumentBlockType = (typeof documentBlockInstructionPairs)[number]['type'];

export const documentBlockInstructionByType = Object.fromEntries(
	documentBlockInstructionPairs.map(pair => [pair.type, pair])
) as { readonly [Type in DocumentBlockType]: Extract<(typeof documentBlockInstructionPairs)[number], { type: Type }> };

export type CompilableBlockType = Exclude<DocumentBlockType, 'note' | 'includes'>;
export const compilableBlockTypes = documentBlockInstructionPairs
	.map(({ type }) => type)
	.filter((type): type is CompilableBlockType => type !== 'note' && type !== 'includes');

export type CodegenInstructionName = Extract<CodegenInstructionSpecName, SourceInstructionSpecName>;

export const codegenInstructionNames = instructionSpecEntries
	.filter(([, spec]) => spec.sourceInstruction !== false && spec.codegen !== false)
	.map(([instruction]) => instruction) as CodegenInstructionName[];

const codegenInstructionNameSet: ReadonlySet<string> = new Set(codegenInstructionNames);

export function isCodegenInstructionName(instruction: string): instruction is CodegenInstructionName {
	return codegenInstructionNameSet.has(instruction);
}

export function hasBinaryMatchingOperands(spec: InstructionSpec | undefined): boolean {
	return (
		spec?.operandTypes === 'matching' &&
		spec.minOperands === 2 &&
		spec.stack?.inputs.length === 2 &&
		spec.stack.inputs.every(input => input === 'T')
	);
}

export type FunctionPreBodyInstructionName = FunctionDeclarationInstructionsByFlag<'preBody'>;

export const functionPreBodyInstructionNames = instructionSpecEntries
	.filter(([, spec]) => spec.functionDeclaration?.preBody === true)
	.map(([instruction]) => instruction) as FunctionPreBodyInstructionName[];

const functionPreBodyInstructionNameSet: ReadonlySet<string> = new Set(functionPreBodyInstructionNames);

export function isFunctionPreBodyInstructionName(instruction: string): instruction is FunctionPreBodyInstructionName {
	return functionPreBodyInstructionNameSet.has(instruction);
}

/**
 * Checks whether an instruction starts the executable body of a function.
 */
export function isFunctionBodyInstructionName(instruction: string): boolean {
	return !isFunctionPreBodyInstructionName(instruction);
}

export type ImportedFunctionDeclarationInstructionName = FunctionDeclarationInstructionsByFlag<'importedFunction'>;

export const importedFunctionDeclarationInstructionNames = instructionSpecEntries
	.filter(([, spec]) => spec.functionDeclaration?.importedFunction === true)
	.map(([instruction]) => instruction) as ImportedFunctionDeclarationInstructionName[];

const importedFunctionDeclarationInstructionNameSet: ReadonlySet<string> = new Set(
	importedFunctionDeclarationInstructionNames
);

export function isImportedFunctionDeclarationInstructionName(
	instruction: string
): instruction is ImportedFunctionDeclarationInstructionName {
	return importedFunctionDeclarationInstructionNameSet.has(instruction);
}

export type SubProgramInstruction =
	| CodegenInstructionName
	| MemoryDeclarationInstruction
	| SemanticInstructionName
	| DocumentOnlyInstructionName;

/** Instructions accepted by the tokenizer after project-level source has been extracted. */
export const subProgramInstructionNameSet: ReadonlySet<string> = new Set([
	...codegenInstructionNames,
	...memoryDeclarationInstructions,
	...semanticInstructionNames,
	...documentOnlyInstructionNames,
]);

export type Instruction = SubProgramInstruction | ProjectInstructionName;

/** Every instruction name accepted anywhere in an 8f4e project source. */
export const knownInstructionNameSet: ReadonlySet<string> = new Set([
	...subProgramInstructionNameSet,
	...projectInstructionNames,
]);

/** Checks whether an instruction is accepted by the subprogram tokenizer. */
export function isSubProgramInstructionName(instruction: string): instruction is SubProgramInstruction {
	return subProgramInstructionNameSet.has(instruction);
}
