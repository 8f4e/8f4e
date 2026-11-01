import type {
	Argument,
	ArgumentCompileTimeExpression,
	ArgumentIdentifier,
	ArgumentLiteral,
	ArgumentStringLiteral,
} from './arguments';
import type { SourceMetadata } from './compiled';
import type { InlineOperandInstructionName, NoSourceArgumentInstructionName } from './instructionSpecTypes';
import type { DocumentOnlyInstructionName, SemanticInstructionName } from './instructions';
import { semanticInstructionNames } from './instructions';
import {
	type ArrayDeclarationInstruction,
	isArrayMemoryDeclarationInstructionName,
	isMemoryDeclarationInstructionName,
	isScalarMemoryDeclarationInstructionName,
	type ScalarMemoryDeclarationInstruction,
} from './memory';
import type { ProjectGroupPath } from './project';

type ClampAddressInstructionName = 'clampAddress' | 'clampModuleAddress' | 'clampGlobalAddress';

export type ASTLineBase<Instruction extends string, Arguments extends Array<Argument>> = {
	lineNumber: number;
	instruction: Instruction;
	arguments: Arguments;
};

export type CompileTimeValueArgument = ArgumentLiteral | ArgumentIdentifier | ArgumentCompileTimeExpression;
export type PushArgument = ArgumentLiteral | ArgumentIdentifier | ArgumentCompileTimeExpression | ArgumentStringLiteral;
export type PushLine = ASTLineBase<'push', [PushArgument]>;
export type InlineOperandLine = ASTLineBase<InlineOperandInstructionName, [] | [PushArgument]>;
export type AssertEqualLine = ASTLineBase<'assertEqual', [CompileTimeValueArgument]>;

export const BLOCK_RESULT_TYPE_IDENTIFIERS = ['int', 'float'] as const;
export type BlockResultType = (typeof BLOCK_RESULT_TYPE_IDENTIFIERS)[number];
export type BlockResultTypes = BlockResultType[];

const blockResultTypeIdentifierSet: ReadonlySet<string> = new Set(BLOCK_RESULT_TYPE_IDENTIFIERS);

export function isBlockResultTypeIdentifier(type: string): type is BlockResultType {
	return blockResultTypeIdentifierSet.has(type);
}

/** Parser metadata linking an `if` line to its closing line and result shape. */
export interface IfBlockMetadata {
	matchingIfEndIndex: number;
	resultTypes: BlockResultTypes;
	hasElse: boolean;
}

/** Parser metadata linking an `ifEnd` line back to its opening `if`. */
export interface IfEndBlockMetadata {
	matchingIfIndex: number;
	resultTypes: BlockResultTypes;
}

export type IfLine = ASTLineBase<'if', []> & {
	ifBlock?: IfBlockMetadata;
};
export type PairedIfLine = IfLine & {
	ifBlock: IfBlockMetadata;
};
export type IfEndLine = ASTLineBase<'ifEnd', ArgumentIdentifier[]> & {
	ifEndBlock?: IfEndBlockMetadata;
};

/** Parser metadata linking a generic `block` line to its closing line. */
export interface BlockBlockMetadata {
	matchingBlockEndIndex: number;
	resultTypes: BlockResultTypes;
}

/** Parser metadata linking a `blockEnd` line back to its opening `block`. */
export interface BlockEndBlockMetadata {
	matchingBlockIndex: number;
	resultTypes: BlockResultTypes;
}

export type BlockLine = ASTLineBase<'block', []> & {
	blockBlock?: BlockBlockMetadata;
};
export type PairedBlockLine = BlockLine & {
	blockBlock: BlockBlockMetadata;
};
export type BlockEndLine = ASTLineBase<'blockEnd', [] | [ArgumentIdentifier]> & {
	blockEndBlock?: BlockEndBlockMetadata;
};
export type LocalSetLine = ASTLineBase<'localSet', [ArgumentIdentifier]>;

export type FunctionLine = ASTLineBase<'function', [ArgumentIdentifier]>;
export type FunctionEndLine = ASTLineBase<'functionEnd', ArgumentIdentifier[]>;
export type CallLine = ASTLineBase<'call', [ArgumentIdentifier, ...PushArgument[]]>;
export type ModuleLine = ASTLineBase<'module', [ArgumentIdentifier]>;
export type ModuleEndLine = ASTLineBase<'moduleEnd', []>;
export type ConstantsLine = ASTLineBase<'constants', [ArgumentIdentifier]>;
export type ConstantsEndLine = ASTLineBase<'constantsEnd', []>;
export type PrototypeLine = ASTLineBase<'prototype', [ArgumentIdentifier]>;
export type PrototypeEndLine = ASTLineBase<'prototypeEnd', []>;
export type ShapeLine = ASTLineBase<'shape', [ArgumentIdentifier]>;
export type ParamShapeLine = ASTLineBase<'paramShape', [ArgumentIdentifier]>;
export type PushShapeLine = ASTLineBase<'pushShape', [ArgumentIdentifier]>;
export type UseLine = ASTLineBase<'use', [ArgumentIdentifier]>;
export type LocalDeclarationLine = ASTLineBase<'local', [ArgumentIdentifier, ArgumentIdentifier]>;
export type ParamLine = ASTLineBase<'param', [ArgumentIdentifier, ArgumentIdentifier]>;
export type MapBeginLine = ASTLineBase<'mapBegin', [ArgumentIdentifier]>;
export type MapEndLine = ASTLineBase<'mapEnd', [ArgumentIdentifier]>;
export type BranchLine = ASTLineBase<'branch', [ArgumentLiteral]>;
export type BranchIfTrueLine = ASTLineBase<'branchIfTrue', [ArgumentLiteral]>;
export type ExitIfTrueLine = ASTLineBase<'exitIfTrue', []>;
export type StoreBytesLine = ASTLineBase<'storeBytes', [ArgumentLiteral]>;
export type MemoryCopyLine = ASTLineBase<'memoryCopy', [CompileTimeValueArgument]>;
export type ConstLine = ASTLineBase<'const', [ArgumentIdentifier, CompileTimeValueArgument]>;
export type EnsureNonZeroLine = ASTLineBase<'ensureNonZero', [] | [ArgumentLiteral]>;

export type MapValueArgument =
	| ArgumentLiteral
	| ArgumentIdentifier
	| ArgumentCompileTimeExpression
	| ArgumentStringLiteral;
export type MapLine = ASTLineBase<'map', [MapValueArgument] | [MapValueArgument, MapValueArgument]>;

export type DefaultLine = ASTLineBase<'default', [CompileTimeValueArgument]>;

type CompilerDirectivePrologueMetadata = {
	isBlockPrologue?: true;
};

export type LoopLine = ASTLineBase<'loop', [] | [CompileTimeValueArgument]>;
export type LoopEndLine = ASTLineBase<'loopEnd', []>;
export type LoopIndexLine = ASTLineBase<'loopIndex', []>;
export type ElseLine = ASTLineBase<'else', []>;
export type ReturnLine = ASTLineBase<'return', []>;
export type LoopCapLine = ASTLineBase<'#loopCap', [ArgumentLiteral]> & CompilerDirectivePrologueMetadata;
export type ImpureLine = ASTLineBase<'#impure', []> & CompilerDirectivePrologueMetadata;
export type ExportLine = ASTLineBase<'#export', [] | [ArgumentIdentifier]> & CompilerDirectivePrologueMetadata;
export type ImportLine = ASTLineBase<'#import', [ArgumentIdentifier | ArgumentStringLiteral]> &
	CompilerDirectivePrologueMetadata;
export type SkipExecutionLine = ASTLineBase<'#skipExecution', []> & CompilerDirectivePrologueMetadata;
export type ClampAddressLine = ASTLineBase<ClampAddressInstructionName, [] | [CompileTimeValueArgument]>;
export type CompilerDirectiveLine = LoopCapLine | ImpureLine | ExportLine | ImportLine | SkipExecutionLine;

export type MemoryDeclarationArgument =
	| ArgumentLiteral
	| ArgumentIdentifier
	| ArgumentCompileTimeExpression
	| ArgumentStringLiteral;

export type ScalarMemoryDeclarationLine = ASTLineBase<
	ScalarMemoryDeclarationInstruction,
	[MemoryDeclarationArgument, ...MemoryDeclarationArgument[]]
>;
export type NamedScalarMemoryDeclarationLine = Omit<ScalarMemoryDeclarationLine, 'arguments'> & {
	arguments: [ArgumentIdentifier, ...MemoryDeclarationArgument[]];
};
export type ArrayMemoryDeclarationLine = ASTLineBase<
	ArrayDeclarationInstruction,
	[ArgumentIdentifier, CompileTimeValueArgument, ...MemoryDeclarationArgument[]]
>;
export type MemoryDeclarationLine = ScalarMemoryDeclarationLine | ArrayMemoryDeclarationLine;

export type SemanticInstructionLine =
	| ConstLine
	| UseLine
	| ModuleLine
	| ModuleEndLine
	| ConstantsLine
	| ConstantsEndLine
	| PrototypeLine
	| PrototypeEndLine
	| ShapeLine;

type ExplicitCompilerASTLineWithoutGenericNoSource =
	| PushLine
	| InlineOperandLine
	| AssertEqualLine
	| IfLine
	| IfEndLine
	| BlockLine
	| BlockEndLine
	| LocalSetLine
	| FunctionLine
	| FunctionEndLine
	| CallLine
	| ModuleLine
	| ModuleEndLine
	| ConstantsLine
	| ConstantsEndLine
	| PrototypeLine
	| PrototypeEndLine
	| ShapeLine
	| ParamShapeLine
	| PushShapeLine
	| UseLine
	| LocalDeclarationLine
	| ParamLine
	| MapBeginLine
	| MapEndLine
	| BranchLine
	| BranchIfTrueLine
	| ExitIfTrueLine
	| StoreBytesLine
	| MemoryCopyLine
	| ConstLine
	| EnsureNonZeroLine
	| MapLine
	| DefaultLine
	| LoopLine
	| LoopEndLine
	| LoopIndexLine
	| ElseLine
	| ReturnLine
	| LoopCapLine
	| ImpureLine
	| ExportLine
	| ImportLine
	| SkipExecutionLine
	| ClampAddressLine
	| MemoryDeclarationLine;

type GenericNoSourceArgumentInstructionName = Exclude<
	NoSourceArgumentInstructionName,
	ExplicitCompilerASTLineWithoutGenericNoSource['instruction']
>;

export type NoSourceArgumentLine = ASTLineBase<GenericNoSourceArgumentInstructionName, []>;

type ExplicitCompilerASTLine = ExplicitCompilerASTLineWithoutGenericNoSource | NoSourceArgumentLine;

export type CompilerASTLine = ExplicitCompilerASTLine | ASTLineBase<DocumentOnlyInstructionName, Array<Argument>>;

export type CompilerASTLines = CompilerASTLine[];

/** Compiler project/source metadata carried with a parsed source block. */
export interface SourceBlockMetadata {
	projectBlockId?: number;
	source?: SourceMetadata;
}

/** Parsed AST for a module block and its memory declarations. */
export interface ModuleAST extends SourceBlockMetadata {
	type: 'module';
	id: string;
	lines: CompilerASTLines;
	moduleLine: ModuleLine;
}

/** Parsed AST for a function block. */
export interface FunctionAST extends SourceBlockMetadata {
	type: 'function';
	/** Source-level callable name written after the `function` instruction. */
	name: string;
	lines: CompilerASTLines;
	functionLine: FunctionLine;
	functionEndLine: FunctionEndLine;
	exportLine?: ExportLine;
	importLine?: ImportLine;
}

/** Parsed AST for a constants block. */
export interface ConstantsAST extends SourceBlockMetadata {
	type: 'constants';
	id: string;
	lines: CompilerASTLines;
	constantsLine: ConstantsLine;
}

/** Parsed AST for a reusable memory-shape prototype block. */
export interface PrototypeAST extends SourceBlockMetadata {
	type: 'prototype';
	id: string;
	lines: CompilerASTLines;
	prototypeLine: PrototypeLine;
}

export type AST = ModuleAST | FunctionAST | ConstantsAST | PrototypeAST;

declare const validatedASTBrand: unique symbol;

/** AST produced by the tokenizer after source-level syntax and block validation. */
export type ValidatedAST<TAST extends AST = AST> = TAST & {
	readonly [validatedASTBrand]: true;
};
export type ValidatedModuleAST = ValidatedAST<ModuleAST>;
export type ValidatedFunctionAST = ValidatedAST<FunctionAST>;
export type ValidatedConstantsAST = ValidatedAST<ConstantsAST>;
export type ValidatedPrototypeAST = ValidatedAST<PrototypeAST>;

/** Source identity guaranteed by composition, before include renaming and group qualification. */
export interface SourceBlockIdentity {
	projectGroupPath: ProjectGroupPath;
	codeBlockId: string;
}

/** Validated source block with its original identity preserved by program composition. */
export type ComposedAST<TAST extends ValidatedAST = ValidatedAST> = TAST & {
	sourceIdentity: SourceBlockIdentity;
};
export type ComposedModuleAST = ComposedAST<ValidatedModuleAST> & {
	/** Canonical identity of the owning entry, established by composition. */
	executionEntryName: string;
};
export type ComposedFunctionAST = ComposedAST<ValidatedFunctionAST>;
export type ComposedConstantsAST = ComposedAST<ValidatedConstantsAST>;
export type ComposedPrototypeAST = ComposedAST<ValidatedPrototypeAST>;

const semanticInstructionSet = new Set<string>(semanticInstructionNames);

/**
 * Checks whether a parsed line is a semantic instruction handled before code generation.
 * These lines affect compiler state or namespaces rather than directly producing
 * WebAssembly instructions.
 *
 * @param line - Parsed compiler AST line to inspect.
 * @returns True when the line is a semantic instruction.
 */
export function isSemanticInstructionLine(line: CompilerASTLine | undefined): line is SemanticInstructionLine {
	return line !== undefined && semanticInstructionSet.has(line.instruction as SemanticInstructionName);
}

/**
 * Checks whether a parsed line is a compiler directive instruction.
 *
 * @param line - Parsed compiler AST line to inspect.
 * @returns True when the instruction is a compiler directive.
 */
export function isCompilerDirectiveLine(line: CompilerASTLine | undefined): line is CompilerDirectiveLine {
	return line !== undefined && line.instruction.startsWith('#');
}

/**
 * Checks whether a parsed line declares scalar or array memory.
 * The parser keeps declarations in the same AST union as executable lines; this
 * guard narrows them before layout and namespace collection.
 *
 * @param line - Parsed compiler AST line to inspect.
 * @returns True when the line declares memory.
 */
export function isMemoryDeclarationLine(line: CompilerASTLine | undefined): line is MemoryDeclarationLine {
	return line !== undefined && isMemoryDeclarationInstructionName(line.instruction);
}

/**
 * Checks whether a parsed line declares scalar memory.
 *
 * @param line - Parsed compiler AST line to inspect.
 * @returns True when the line declares scalar memory.
 */
export function isScalarMemoryDeclarationLine(line: CompilerASTLine | undefined): line is ScalarMemoryDeclarationLine {
	return line !== undefined && isScalarMemoryDeclarationInstructionName(line.instruction);
}

/**
 * Checks whether a parsed line declares array memory.
 *
 * @param line - Parsed compiler AST line to inspect.
 * @returns True when the line declares array memory.
 */
export function isArrayMemoryDeclarationLine(line: CompilerASTLine | undefined): line is ArrayMemoryDeclarationLine {
	return line !== undefined && isArrayMemoryDeclarationInstructionName(line.instruction);
}
