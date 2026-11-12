import type { State } from '@8f4e/editor-state-types';
import type { CompileResult } from '@8f4e/language-spec';

/** Supplies the accepted input revision for compiler-backed tooltip fixtures. */
export function createCompilerResult(compiled: CompileResult, inputRevision: number): State['compiler']['result'] {
	return { ...compiled, inputRevision };
}
