import type { ASTCache, ASTCacheEntry, ValidatedAST } from '@8f4e/language-spec';

export { createASTCache } from './cache';

import { hashSource } from './cache';
import { mainTokenizerLoop } from './mainTokenizerLoop';

export { parseInstructionTokens, parseLine } from './parseLine';
export { parseProjectConstantNamespacePassLine } from './parseProjectConstantNamespacePassLine';
export { parseProjectMemoryInitializerLine } from './parseProjectMemoryInitializerLine';

import { createASTFromBuilder } from './sourceBlockASTBuilder';
import instructionParser from './syntax/instructionParser';
import { SyntaxErrorCode, SyntaxRulesError } from './syntax/syntaxError';

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
 * @param cache - Optional compiler cache used to reuse parsed artifacts.
 * @param cacheKey - Optional cache key for the source block.
 * @returns Validated AST for the source block.
 */
export function compileToAST(code: string[], cache?: ASTCache<ValidatedAST>, cacheKey?: string): ValidatedAST {
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
		throw new SyntaxRulesError(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, 'Expected a compiler source block.', {
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
