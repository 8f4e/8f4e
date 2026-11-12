import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompiledStackAnalysisLine, CompilerASTLine } from '@8f4e/language-spec';
import { getCompiledFunctionForCodeBlock } from './getCompiledFunctionForCodeBlock';
import { getCompiledModuleForCodeBlock } from './getCompiledModuleForCodeBlock';

export interface CurrentCompiledLine {
	parsedLine: CompilerASTLine | undefined;
	stackAnalysisLine: CompiledStackAnalysisLine | undefined;
	/** Maps zero-based source lines in the accepted compilation to the current block's source lines. */
	currentSourceLineByCompiledLine: ReadonlyMap<number, number>;
}

/** Aligns unchanged source instructions across comment/blank-line edits without guessing between repeated lines. */
function mapSourceRows(source: readonly string[], current: readonly string[]): Map<number, number> | undefined {
	const isCommentOrBlank = (line: string) => /^\s*(?:;|$)/.test(line);
	const rows = new Map<number, number>();
	let currentRow = 0;
	for (let sourceRow = 0; sourceRow < source.length; sourceRow++) {
		if (isCommentOrBlank(source[sourceRow])) continue;
		while (currentRow < current.length && isCommentOrBlank(current[currentRow])) currentRow++;
		if (source[sourceRow] !== current[currentRow]) return undefined;
		rows.set(sourceRow, currentRow++);
	}
	while (currentRow < current.length && isCommentOrBlank(current[currentRow])) currentRow++;
	return currentRow === current.length ? rows : undefined;
}

/** Returns line metadata only for current compiler inputs and unchanged instructions in the owning source block. */
export function getCurrentCompiledLineForCodeBlock(
	block: CodeBlockGraphicData,
	state: State,
	sourceLineNumber = block.cursor.row
): CurrentCompiledLine | undefined {
	const result = state.compiler.result;
	if (result.inputRevision !== state.compilerInputRevision) return undefined;
	const source = result.sourceCodeByBlockId[block.creationIndex];
	if (!source) return undefined;
	const currentSourceLineByCompiledLine = mapSourceRows(source, block.code);
	if (!currentSourceLineByCompiledLine) return undefined;
	const compilation =
		block.blockType === 'function'
			? getCompiledFunctionForCodeBlock(block, state)
			: getCompiledModuleForCodeBlock(block, state);
	if (!compilation) return undefined;
	return {
		parsedLine: compilation.ast.lines.find(
			line => currentSourceLineByCompiledLine.get(line.lineNumber) === sourceLineNumber
		),
		stackAnalysisLine: compilation.stackAnalysis?.find(
			line => currentSourceLineByCompiledLine.get(line.lineNumber) === sourceLineNumber
		),
		currentSourceLineByCompiledLine,
	};
}
