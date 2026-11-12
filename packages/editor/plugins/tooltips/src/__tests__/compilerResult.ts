import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompileResult } from '@8f4e/language-spec';

/** Supplies explicit source identity for compiler-backed tooltip fixtures. */
export function createCompilerResult(
	compiled: CompileResult,
	inputRevision: number,
	blocks: readonly Pick<CodeBlockGraphicData, 'creationIndex' | 'code'>[]
): State['compiler']['result'] {
	return {
		...compiled,
		inputRevision,
		sourceCodeByBlockId: Object.fromEntries(blocks.map(block => [block.creationIndex, [...block.code]])),
	};
}
