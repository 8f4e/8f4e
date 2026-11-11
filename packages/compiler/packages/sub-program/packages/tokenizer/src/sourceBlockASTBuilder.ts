import type {
	AST,
	CompilerASTLine,
	CompilerASTLines,
	ConstantsLine,
	ExportLine,
	FunctionEndLine,
	FunctionLine,
	ImportLine,
	ModuleLine,
	PrototypeLine,
} from '@8f4e/language-spec';
import { isFunctionBodyInstructionName, isImportedFunctionDeclarationInstructionName } from '@8f4e/language-spec';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';

/** Accumulates module-specific lines while the tokenizer builds a validated AST. */
type ModuleASTBuilder = {
	type: 'module';
	id: string;
	moduleLine: ModuleLine;
};

/** Accumulates function-specific metadata while the tokenizer builds a validated AST. */
type FunctionASTBuilder = {
	type: 'function';
	name: string;
	functionLine: FunctionLine;
	functionEndLine?: FunctionEndLine;
	exportLine?: ExportLine;
	importLine?: ImportLine;
	bodyStarted?: boolean;
};

/** Accumulates constants-block metadata while the tokenizer builds a validated AST. */
type ConstantsASTBuilder = {
	type: 'constants';
	id: string;
	constantsLine: ConstantsLine;
};

/** Accumulates prototype memory declarations while the tokenizer builds a validated AST. */
type PrototypeASTBuilder = {
	type: 'prototype';
	id: string;
	prototypeLine: PrototypeLine;
};

/** Source block builder selected from the first valid source block in parsed input. */
export type SourceBlockASTBuilder = ModuleASTBuilder | FunctionASTBuilder | ConstantsASTBuilder | PrototypeASTBuilder;

/**
 * Creates the source-block builder represented by a parsed block-start line.
 *
 * @param line - Source AST line being processed.
 * @returns Source-block AST builder for the line, or `undefined` when the line is not a source-block opener.
 */
export function createSourceBlockASTBuilder(line: CompilerASTLine): SourceBlockASTBuilder | undefined {
	switch (line.instruction) {
		case 'module':
			return {
				type: 'module',
				id: line.arguments[0].value,
				moduleLine: line,
			};
		case 'function':
			return {
				type: 'function',
				name: line.arguments[0].value,
				functionLine: line,
			};
		case 'constants':
			return {
				type: 'constants',
				id: line.arguments[0].value,
				constantsLine: line,
			};
		case 'prototype':
			return {
				type: 'prototype',
				id: line.arguments[0].value,
				prototypeLine: line,
			};
		default:
			return undefined;
	}
}

/** Validates function declaration structure while collecting its AST metadata. */
function applyFunctionASTLine(builder: FunctionASTBuilder, line: CompilerASTLine): void {
	if (builder.bodyStarted && (line.instruction === 'param' || line.instruction === 'paramShape')) {
		throw new SyntaxIssue(SyntaxErrorCode.PARAM_AFTER_FUNCTION_BODY, undefined, line);
	}

	switch (line.instruction) {
		case '#export':
			if (builder.importLine) {
				throw new SyntaxIssue(SyntaxErrorCode.IMPORT_EXPORT_CONFLICT, undefined, line);
			}
			if (builder.exportLine) {
				throw new SyntaxIssue(SyntaxErrorCode.DUPLICATE_FUNCTION_EXPORT, undefined, line);
			}
			builder.exportLine = line;
			return;
		case '#import':
			if (builder.importLine) {
				throw new SyntaxIssue(SyntaxErrorCode.DUPLICATE_FUNCTION_IMPORT, undefined, line);
			}
			if (builder.exportLine) {
				throw new SyntaxIssue(SyntaxErrorCode.IMPORT_EXPORT_CONFLICT, undefined, line);
			}
			builder.importLine = line;
			return;
	}

	if (builder.importLine && !isImportedFunctionDeclarationInstructionName(line.instruction)) {
		throw new SyntaxIssue(SyntaxErrorCode.IMPORTED_FUNCTION_BODY, undefined, line);
	}
	if (isFunctionBodyInstructionName(line.instruction)) {
		builder.bodyStarted = true;
	}
	if (line.instruction === 'functionEnd') {
		builder.functionEndLine = line;
	}
}

/**
 * Routes a parsed line into the active source-block builder.
 *
 * @param builder - Source-block AST builder to update.
 * @param line - Source AST line being processed.
 * @returns Nothing.
 */
export function applySourceBlockASTLine(builder: SourceBlockASTBuilder, line: CompilerASTLine): void {
	switch (builder.type) {
		case 'module':
			return;
		case 'function':
			applyFunctionASTLine(builder, line);
			return;
		case 'constants':
			return;
		case 'prototype':
			return;
	}
}

/**
 * Materializes the final validated AST from accumulated source-block metadata.
 *
 * @param lines - Parsed instruction stream for the source block.
 * @param builder - Source-block metadata collected during tokenization.
 * @returns The source-block AST represented by the builder.
 */
export function createASTFromBuilder(lines: CompilerASTLines, builder: SourceBlockASTBuilder): AST {
	switch (builder.type) {
		case 'module':
			return {
				type: 'module',
				id: builder.id,
				lines,
				moduleLine: builder.moduleLine,
			};
		case 'function':
			if (!builder.functionEndLine) {
				throw new SyntaxIssue(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, 'Expected a matching functionEnd.', {
					lineNumber: builder.functionLine.lineNumber,
					instruction: builder.functionLine.instruction,
				});
			}

			return {
				type: 'function',
				name: builder.name,
				lines,
				functionLine: builder.functionLine,
				functionEndLine: builder.functionEndLine,
				...(builder.exportLine ? { exportLine: builder.exportLine } : {}),
				...(builder.importLine ? { importLine: builder.importLine } : {}),
			};
		case 'constants':
			return {
				type: 'constants',
				id: builder.id,
				lines,
				constantsLine: builder.constantsLine,
			};
		case 'prototype':
			return {
				type: 'prototype',
				id: builder.id,
				lines,
				prototypeLine: builder.prototypeLine,
			};
	}
}
