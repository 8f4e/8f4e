import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompiledStackAnalysisLine, CompilerASTLine } from '@8f4e/language-spec';
import { getCompiledFunctionForCodeBlock } from './getCompiledFunctionForCodeBlock';
import { getCompiledModuleForCodeBlock } from './getCompiledModuleForCodeBlock';

export interface CurrentCompiledLine {
	parsedLine: CompilerASTLine | undefined;
	stackAnalysisLine: CompiledStackAnalysisLine | undefined;
}

/** Returns the owning source block's authoritative line metadata when its compiler input revision is current. */
export function getCurrentCompiledLineForCodeBlock(
	block: CodeBlockGraphicData,
	state: State,
	sourceLineNumber = block.cursor.row
): CurrentCompiledLine | undefined {
	if (state.compiler.result.inputRevision !== state.compilerInputRevision) return undefined;
	const compilation =
		block.blockType === 'function'
			? getCompiledFunctionForCodeBlock(block, state)
			: getCompiledModuleForCodeBlock(block, state);
	if (!compilation) return undefined;
	return {
		parsedLine: compilation.ast.lines.find(line => line.lineNumber === sourceLineNumber),
		stackAnalysisLine: compilation.stackAnalysis?.find(line => line.lineNumber === sourceLineNumber),
	};
}
