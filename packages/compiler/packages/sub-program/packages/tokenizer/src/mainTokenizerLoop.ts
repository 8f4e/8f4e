import type {
	BlockEndInstruction,
	BlockEndLine,
	BlockLine,
	BlockPlacement,
	BlockResultTypes,
	BlockStartInstruction,
	CompilerASTLine,
	CompilerASTLines,
	IfEndLine,
	IfLine,
	InstructionPlacement,
	NestedBlockPlacement,
	SourceBlockPlacement,
} from '@8f4e/language-spec';
import {
	blockEndToStartInstruction,
	blockStartInstructions,
	compilerSourceBlockInstructionPairs,
	getInstructionSpec,
	isCompilerDirectiveLine,
	isMemoryDeclarationLine,
	isSemanticInstructionLine,
} from '@8f4e/language-spec';
import { parseLine } from './parseLine';
import {
	applySourceBlockASTLine,
	createSourceBlockASTBuilder,
	type SourceBlockASTBuilder,
} from './sourceBlockASTBuilder';
import { foldArgumentContinuationLines } from './sourceLines';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';

/** Parsed source lines plus the source-block builder needed to materialize the final AST. */
export type MainTokenizerLoopResult = {
	lines: CompilerASTLines;
	astBuilder?: SourceBlockASTBuilder;
};

/** Open-block stack frame for an `if` block while matching branches and result metadata. */
type IfOpenBlock = {
	instruction: 'if';
	astIndex: number;
	line: IfLine;
	hasElse: boolean;
};

/** Open-block stack frame for a generic `block` while matching its end metadata. */
type GenericOpenBlock = {
	instruction: 'block';
	astIndex: number;
	line: BlockLine;
};

/** Open-block stack frame for blocks that do not need tokenizer-side line metadata. */
type OtherOpenBlock = {
	instruction: Exclude<BlockStartInstruction, 'if' | 'block'>;
	astIndex: number;
};

/** Any currently open block tracked by the tokenizer's single parsing pass. */
type OpenBlock = IfOpenBlock | GenericOpenBlock | OtherOpenBlock;

/** Tracks a source block prologue so directives can be restricted to the top of a block. */
type SourceBlockPrologue = {
	instruction: (typeof compilerSourceBlockInstructionPairs)[number]['start'];
	blockDepth: number;
	isOpen: boolean;
};

/** Cached placement state maintained by the tokenizer's main loop. */
type ParserBlockState = {
	currentSourceBlock?: SourceBlockPlacement;
	loopDepth: number;
	mapDepth: number;
	blockDepth: number;
	ifDepth: number;
};

/** Fast membership lookup for block-start instructions. */
const blockStartInstructionSet = new Set<BlockStartInstruction>(blockStartInstructions);

/** Fast membership lookup for top-level source block start instructions. */
const sourceBlockStartInstructionSet: ReadonlySet<string> = new Set(
	compilerSourceBlockInstructionPairs.map(({ start }) => start)
);

/** Fast membership lookup for top-level source block end instructions. */
const sourceBlockEndInstructionSet: ReadonlySet<string> = new Set(
	compilerSourceBlockInstructionPairs.map(({ end }) => end)
);

/** Narrows an instruction string to block-start instructions known by the language spec. */
function isBlockStartInstruction(instruction: string): instruction is BlockStartInstruction {
	return blockStartInstructionSet.has(instruction as BlockStartInstruction);
}

/** Narrows an instruction string to block-end instructions known by the language spec. */
function isBlockEndInstruction(instruction: string): instruction is BlockEndInstruction {
	return Object.hasOwn(blockEndToStartInstruction, instruction);
}

/** Creates the tokenizer's cached block-placement state. */
function createParserBlockState(): ParserBlockState {
	return {
		loopDepth: 0,
		mapDepth: 0,
		blockDepth: 0,
		ifDepth: 0,
	};
}

/** Throws the placement syntax error with the source line metadata attached. */
function throwInstructionNotAllowedInBlock(line: CompilerASTLine): never {
	throw new SyntaxIssue(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, undefined, {
		lineNumber: line.lineNumber,
		instruction: line.instruction,
	});
}

/** Reads placement rules for regular instructions and shared memory declarations. */
function getInstructionPlacement(line: CompilerASTLine): InstructionPlacement | undefined {
	if (isMemoryDeclarationLine(line)) {
		return getInstructionSpec('memoryDeclaration')?.placement;
	}

	return getInstructionSpec(line.instruction)?.placement;
}

/** Reads cached nested-block depth for a block kind without scanning the open-block stack. */
function getNestedBlockDepth(state: ParserBlockState, block: NestedBlockPlacement): number {
	switch (block) {
		case 'loop':
			return state.loopDepth;
		case 'map':
			return state.mapDepth;
		case 'block':
			return state.blockDepth;
		case 'if':
			return state.ifDepth;
	}
}

/** Narrows a placement kind to source blocks that own independent ASTs. */
function isSourceBlockPlacement(block: string): block is SourceBlockPlacement {
	return block === 'module' || block === 'function' || block === 'constants' || block === 'prototype';
}

/** Reads block metadata for a block-start instruction from the language spec. */
function getBlockStartPlacement(instruction: BlockStartInstruction): InstructionPlacement['block'] | undefined {
	const placement = getInstructionSpec(instruction)?.placement as InstructionPlacement | undefined;
	return placement?.block;
}

/** Resolves the placement kind of the current immediate parent block. */
function getOpenBlockPlacementKind(block: OpenBlock | undefined): BlockPlacement | undefined {
	return block ? getBlockStartPlacement(block.instruction)?.kind : undefined;
}

/** Validates the immediate parent constraint for block-start instructions. */
function validatePlacementParent(
	line: CompilerASTLine,
	placement: InstructionPlacement,
	parentBlockKind: BlockPlacement | undefined
): void {
	const block = placement.block;
	if (!block || block.role !== 'start' || !block.parents) {
		return;
	}

	if (block.parents.length === 0) {
		if (parentBlockKind !== undefined) {
			throwInstructionNotAllowedInBlock(line);
		}
		return;
	}

	if (!parentBlockKind || !block.parents.includes(parentBlockKind)) {
		throwInstructionNotAllowedInBlock(line);
	}
}

/** Applies language-spec placement rules using tokenizer-maintained block state. */
function validateInstructionPlacement(
	line: CompilerASTLine,
	state: ParserBlockState,
	parentBlockKind: BlockPlacement | undefined
): void {
	const placement = getInstructionPlacement(line);
	if (!placement) {
		return;
	}

	if (state.mapDepth > 0 && placement.requiredNestedBlock !== 'map' && placement.block?.kind !== 'map') {
		throwInstructionNotAllowedInBlock(line);
	}

	if (state.currentSourceBlock) {
		if (placement.sourceBlocks && !placement.sourceBlocks.includes(state.currentSourceBlock)) {
			throwInstructionNotAllowedInBlock(line);
		}
	} else if (!placement.topLevel && placement.block?.role !== 'start') {
		throwInstructionNotAllowedInBlock(line);
	}

	if (placement.requiredNestedBlock && getNestedBlockDepth(state, placement.requiredNestedBlock) === 0) {
		throwInstructionNotAllowedInBlock(line);
	}

	for (const block of placement.disallowedNestedBlocks ?? []) {
		if (getNestedBlockDepth(state, block) > 0) {
			throwInstructionNotAllowedInBlock(line);
		}
	}

	validatePlacementParent(line, placement, parentBlockKind);
}

/** Updates cached block-placement state when a block starts or ends. */
function updateParserBlockState(state: ParserBlockState, instruction: BlockStartInstruction, delta: 1 | -1): void {
	const block = getBlockStartPlacement(instruction);
	if (!block) {
		return;
	}

	if (isSourceBlockPlacement(block.kind)) {
		state.currentSourceBlock = delta === 1 ? block.kind : undefined;
		return;
	}

	switch (block.kind) {
		case 'loop':
			state.loopDepth += delta;
			return;
		case 'map':
			state.mapDepth += delta;
			return;
		case 'block':
			state.blockDepth += delta;
			return;
		case 'if':
			state.ifDepth += delta;
			return;
	}
}

/** Converts parsed block-end result arguments into the metadata stored on matched block lines. */
function getResultTypesFromArguments(line: IfEndLine | BlockEndLine): BlockResultTypes {
	return line.arguments.map(argument => argument.value as BlockResultTypes[number]);
}

/**
 * Runs the tokenizer's main loop, producing AST lines while validating block structure and placement.
 *
 * @param code - Source lines to process.
 * @returns Parsed instruction stream plus source-block metadata collected by the tokenizer.
 */
export function mainTokenizerLoop(code: string[]): MainTokenizerLoopResult {
	const ast: CompilerASTLines = [];
	let astBuilder: SourceBlockASTBuilder | undefined;
	let onlySemanticLinesBeforeSourceBlock = true;
	const blockStack: OpenBlock[] = [];
	const parserBlockState = createParserBlockState();
	const sourceBlockPrologueStack: SourceBlockPrologue[] = [];
	const sourceLines = foldArgumentContinuationLines(code);

	for (const { line, lineNumber } of sourceLines) {
		const parsedLine = parseLine(line, lineNumber);
		const astIndex = ast.length;
		const isFirstASTLine = ast.length === 0;
		const currentSourceBlockPrologue = sourceBlockPrologueStack[sourceBlockPrologueStack.length - 1];
		const isCompilerDirective = isCompilerDirectiveLine(parsedLine);
		const isInOpenSourceBlockPrologue =
			currentSourceBlockPrologue?.isOpen && currentSourceBlockPrologue.blockDepth === blockStack.length;

		if (isCompilerDirective && isInOpenSourceBlockPrologue) {
			parsedLine.isBlockPrologue = true;
		} else if (isCompilerDirective) {
			throw new SyntaxIssue(SyntaxErrorCode.COMPILER_DIRECTIVE_MUST_BE_PROLOGUE, undefined, {
				lineNumber,
				instruction: parsedLine.instruction,
			});
		}

		if (isInOpenSourceBlockPrologue && !isCompilerDirective) {
			currentSourceBlockPrologue.isOpen = false;
		}

		validateInstructionPlacement(
			parsedLine,
			parserBlockState,
			getOpenBlockPlacementKind(blockStack[blockStack.length - 1])
		);

		ast.push(parsedLine);
		if (!astBuilder) {
			const candidateBuilder = createSourceBlockASTBuilder(parsedLine);
			if (
				candidateBuilder &&
				(isFirstASTLine || (candidateBuilder.type === 'function' && onlySemanticLinesBeforeSourceBlock))
			) {
				astBuilder = candidateBuilder;
			}
		}
		if (astBuilder) {
			applySourceBlockASTLine(astBuilder, parsedLine);
		} else if (!isSemanticInstructionLine(parsedLine)) {
			onlySemanticLinesBeforeSourceBlock = false;
		}

		if (isBlockStartInstruction(parsedLine.instruction)) {
			switch (parsedLine.instruction) {
				case 'if':
					blockStack.push({
						instruction: 'if',
						astIndex,
						line: parsedLine,
						hasElse: false,
					});
					break;
				case 'block':
					blockStack.push({
						instruction: 'block',
						astIndex,
						line: parsedLine,
					});
					break;
				default:
					blockStack.push({
						instruction: parsedLine.instruction,
						astIndex,
					});
			}
			updateParserBlockState(parserBlockState, parsedLine.instruction, 1);

			if (sourceBlockStartInstructionSet.has(parsedLine.instruction)) {
				sourceBlockPrologueStack.push({
					instruction: parsedLine.instruction as SourceBlockPrologue['instruction'],
					blockDepth: blockStack.length,
					isOpen: true,
				});
			}
			continue;
		}

		if (parsedLine.instruction === 'else') {
			const openBlock = blockStack[blockStack.length - 1];

			if (!openBlock || openBlock.instruction !== 'if') {
				throw new SyntaxIssue(
					SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
					'Unexpected else without a matching open if block.',
					{
						lineNumber,
						instruction: parsedLine.instruction,
					}
				);
			}

			if (openBlock.hasElse) {
				throw new SyntaxIssue(
					SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
					'Unexpected else: if blocks may only contain one else branch.',
					{
						lineNumber,
						instruction: parsedLine.instruction,
					}
				);
			}

			openBlock.hasElse = true;
			continue;
		}

		if (!isBlockEndInstruction(parsedLine.instruction)) {
			continue;
		}

		const endInstruction = parsedLine.instruction;
		const expectedStartInstruction = blockEndToStartInstruction[endInstruction];
		const openBlock = blockStack.pop();

		if (!openBlock) {
			throw new SyntaxIssue(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Unexpected ${endInstruction} without a matching open ${expectedStartInstruction} block.`,
				{
					lineNumber,
					instruction: parsedLine.instruction,
				}
			);
		}

		if (openBlock.instruction !== expectedStartInstruction) {
			throw new SyntaxIssue(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Unexpected ${endInstruction}: expected ${openBlock.instruction} to be closed before ending ${expectedStartInstruction}.`,
				{
					lineNumber,
					instruction: parsedLine.instruction,
				}
			);
		}
		updateParserBlockState(parserBlockState, openBlock.instruction, -1);

		if (sourceBlockEndInstructionSet.has(endInstruction)) {
			sourceBlockPrologueStack.pop();
		}

		if (endInstruction !== 'ifEnd' && endInstruction !== 'blockEnd') {
			continue;
		}

		if (parsedLine.instruction === 'ifEnd' && openBlock.instruction === 'if') {
			const resultTypes = getResultTypesFromArguments(parsedLine);
			openBlock.line.ifBlock = {
				matchingIfEndIndex: astIndex,
				resultTypes,
				hasElse: Boolean(openBlock.hasElse),
			};
			parsedLine.ifEndBlock = {
				matchingIfIndex: openBlock.astIndex,
				resultTypes,
			};
		} else if (parsedLine.instruction === 'blockEnd' && openBlock.instruction === 'block') {
			const resultTypes = getResultTypesFromArguments(parsedLine);
			openBlock.line.blockBlock = {
				matchingBlockEndIndex: astIndex,
				resultTypes,
			};
			parsedLine.blockEndBlock = {
				matchingBlockIndex: openBlock.astIndex,
				resultTypes,
			};
		}
	}

	if (blockStack.length > 0) {
		const openBlock = blockStack[blockStack.length - 1];
		const openLine = ast[openBlock.astIndex];

		throw new SyntaxIssue(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, `Unclosed ${openBlock.instruction} block.`, {
			lineNumber: openLine.lineNumber,
			instruction: openBlock.instruction,
		});
	}

	return { lines: ast, astBuilder };
}
