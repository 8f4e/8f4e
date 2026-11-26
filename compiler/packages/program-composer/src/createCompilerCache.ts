import type { CompilerCache, ValidatedAST } from '@8f4e/language-spec';
import { createASTCache } from '@8f4e/tokenizer';

/** Creates the compiler cache shared by parsing and later compilation stages. */
export function createCompilerCache(): CompilerCache {
	return {
		ast: createASTCache<ValidatedAST>(),
	};
}
