import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import type { ASTCache, ASTCacheEntry, CompilerASTLine, DiagnosticSource, ValidatedAST } from '@8f4e/language-spec';

export { createASTCache } from './cache';

import { hashSource } from './cache';
import { mainTokenizerLoop } from './mainTokenizerLoop';

import { createASTFromBuilder } from './sourceBlockASTBuilder';
import instructionParser from './syntax/instructionParser';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';

export * from './syntax';

/** Result of validating a cached AST entry against the current source lines. */
type ASTCacheLookupResult<TAst> = {
	ast?: TAst;
	hash?: number;
};

/** Returns a cached AST only after the cheap line-count and hash checks pass. */
function getASTCacheLookupResult<TAst>(
	cached: ASTCacheEntry<TAst> | undefined,
	code: string[]
): ASTCacheLookupResult<TAst> {
	// Optimize first compilation and obvious cache misses: only hash when an existing same-line-count entry needs validation.
	if (!cached || cached.lineCount !== code.length) {
		return {};
	}

	const hash = hashSource(code);
	const cachedHash = cached.hash ?? (cached.hashInput ? hashSource(cached.hashInput.code) : undefined);

	if (cachedHash === undefined) {
		return { hash };
	}

	cached.hash = cachedHash;
	cached.hashInput = undefined;
	return {
		ast: cachedHash === hash ? cached.ast : undefined,
		hash,
	};
}

/**
 * Compiles source into a validated source-block AST, using the optional cache when available.
 *
 * @param code - Source lines to process.
 * @param source - Source owner attached to the returned AST and any syntax diagnostics.
 * @param cache - Optional compiler cache used to reuse parsed artifacts.
 * @param cacheKey - Optional cache key for the source block.
 * @returns Validated AST for the source block.
 */
export function compileToAST(
	code: string[],
	source: DiagnosticSource,
	cache?: ASTCache<ValidatedAST>,
	cacheKey?: string
): ValidatedAST {
	try {
		return bindSource(parseSourceToAST(code, cache, cacheKey), source);
	} catch (error) {
		if (!(error instanceof SyntaxIssue)) throw error;
		if (!error.line) throw new Error('Syntax parser failed without a source position', { cause: error });
		throw syntaxErrorAt(error.code, error.message, source, error.line);
	}
}

/** Cached syntax trees stay detached from each compilation's source ownership. */
function bindSource(ast: ValidatedAST, diagnosticSource: DiagnosticSource): ValidatedAST {
	if (diagnosticSource.kind === 'document') return ast;
	const boundLines = new Map(ast.lines.map(line => [line, { ...line, diagnosticSource }]));
	const lines = ast.lines.map(line => boundLines.get(line)!);
	const boundLine = <TLine extends CompilerASTLine>(line: TLine): TLine => boundLines.get(line) as TLine;
	switch (ast.type) {
		case 'module':
			return { ...ast, lines, moduleLine: boundLine(ast.moduleLine) };
		case 'constants':
			return { ...ast, lines, constantsLine: boundLine(ast.constantsLine) };
		case 'prototype':
			return { ...ast, lines, prototypeLine: boundLine(ast.prototypeLine) };
		case 'function':
			return {
				...ast,
				lines,
				functionLine: boundLine(ast.functionLine),
				functionEndLine: boundLine(ast.functionEndLine),
				...(ast.exportLine ? { exportLine: boundLine(ast.exportLine) } : {}),
				...(ast.importLine ? { importLine: boundLine(ast.importLine) } : {}),
			};
	}
}

function parseSourceToAST(code: string[], cache?: ASTCache<ValidatedAST>, cacheKey?: string): ValidatedAST {
	const cached = cacheKey !== undefined ? cache?.entries.get(cacheKey) : undefined;
	const cachedLookup = getASTCacheLookupResult(cached, code);
	if (cachedLookup.ast) {
		cache!.stats.hits++;
		return cachedLookup.ast;
	}
	if (cache && cacheKey !== undefined) {
		cache.stats.misses++;
	}

	const parsedSource = mainTokenizerLoop(code);
	if (!parsedSource.astBuilder) {
		const firstLine = parsedSource.lines[0];
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, 'Expected a compiler source block.', {
			lineNumber: firstLine?.lineNumber ?? 0,
			instruction: firstLine?.instruction,
		});
	}

	const group = createASTFromBuilder(parsedSource.lines, parsedSource.astBuilder) as ValidatedAST;

	if (cache && cacheKey !== undefined) {
		const entry: ASTCacheEntry<ValidatedAST> = {
			ast: group,
			hashInput: {
				code: [...code],
			},
			lineCount: code.length,
		};
		if (cachedLookup.hash !== undefined) {
			entry.hash = cachedLookup.hash;
			entry.hashInput = undefined;
		}
		cache.entries.set(cacheKey, entry);
	}

	return group;
}

export { instructionParser };
