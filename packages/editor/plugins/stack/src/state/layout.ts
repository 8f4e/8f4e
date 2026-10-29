import {
	gapCalculator,
	getCodeBlockModuleId,
	getCompiledFunctionForCodeBlock,
	getTabStopsByLine,
	getVisualLineWidth,
	matchEditorDirectives,
} from '@8f4e/editor-state';
import type { CodeBlockGraphicData, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { CompiledStackAnalysisLine } from '@8f4e/language-spec';
import { formatStack } from '../helpers/formatStack';
import type { StackLabel } from '../types';

function getStackAnalysisLines(
	graphicData: CodeBlockGraphicData,
	state: State
): CompiledStackAnalysisLine[] | undefined {
	if (graphicData.blockType === 'function') {
		return getCompiledFunctionForCodeBlock(graphicData, state)?.stackAnalysis;
	}

	return state.compiler.compiledModules[getCodeBlockModuleId(graphicData)]?.stackAnalysis;
}

function findStackAnalysisLine(
	lines: CompiledStackAnalysisLine[],
	lineNumber: number,
	isTrailing: boolean
): CompiledStackAnalysisLine | undefined {
	if (isTrailing) {
		return lines.find(line => line.lineNumber === lineNumber);
	}

	let precedingLine: CompiledStackAnalysisLine | undefined;
	for (const line of lines) {
		if (line.lineNumber >= lineNumber) {
			break;
		}
		precedingLine = line;
	}
	return precedingLine;
}

export function registerStackLayout(
	layout: EditorLayoutRegistry,
	labelsByBlock: WeakMap<CodeBlockGraphicData, StackLabel[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'stack', aliases: ['s'] }]).filter(
			directive => directive.args.length === 0
		);
		labelsByBlock.set(graphicData, []);
		items.forEach(directive => {
			const stackAnalysisLines = getStackAnalysisLines(graphicData, state);
			if (!stackAnalysisLines) {
				return;
			}

			const stackAnalysisLine = findStackAnalysisLine(
				stackAnalysisLines,
				directive.sourceLineIndex,
				directive.isTrailing
			);
			if (!stackAnalysisLine) {
				return;
			}

			const displayRow =
				graphicData.displayModel.sourceLineIndexToDisplayRow[directive.sourceLineIndex] ?? directive.sourceLineIndex;
			const tabStopsByLine = getTabStopsByLine(graphicData.code);
			const visualLineWidth = getVisualLineWidth(
				graphicData.code[directive.sourceLineIndex] || '',
				tabStopsByLine[directive.sourceLineIndex] || []
			);

			labelsByBlock.get(graphicData)!.push({
				x: state.viewport.vGrid * (3 + graphicData.lineNumberColumnWidth + visualLineWidth),
				y: gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid,
				text: formatStack(stackAnalysisLine.stackAnalysis.stackAfter),
			});
		});
	});
	return unsubscribe;
}
