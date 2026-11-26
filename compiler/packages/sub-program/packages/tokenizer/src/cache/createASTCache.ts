import type { ASTCache, ValidatedAST } from '@8f4e/language-spec';

/**
 * Creates astcache.
 *
 * @returns Created astcache.
 */
export default function createASTCache<TAst = ValidatedAST>(): ASTCache<TAst> {
	return {
		entries: new Map(),
		stats: {
			hits: 0,
			misses: 0,
		},
	};
}
