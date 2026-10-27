import {
	gapCalculator,
	getCodeBlockModuleId,
	getCompiledFunctionForCodeBlock,
	getTabStopsByLine,
	getVisualLineWidth,
} from '@8f4e/editor-state';
import type { CodeBlockGraphicData, EditorDirectiveDefinition, State } from '@8f4e/editor-state-types';
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

export function createStackDirective(
	labelsByBlock: WeakMap<CodeBlockGraphicData, StackLabel[]>
): EditorDirectiveDefinition {
	return {
		name: 'stack',
		allowTrailingComment: true,
		aliases: ['s'],
		clearDerivedBlockData: codeBlock => {
			labelsByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			if (directive.args.length > 0) return;
			draft.layoutCallbacks.push({
				onBlockLayoutReady: (graphicData, state, directiveState) => {
					const stackAnalysisLines = getStackAnalysisLines(graphicData, state);
					if (!stackAnalysisLines) {
						return;
					}

					const stackAnalysisLine = findStackAnalysisLine(
						stackAnalysisLines,
						directive.sourceLineIndex,
						!/^\s*;/.test(directive.sourceLine ?? '')
					);
					if (!stackAnalysisLine) {
						return;
					}

					const displayRow =
						directiveState.displayModel.sourceLineIndexToDisplayRow[directive.sourceLineIndex] ??
						directive.sourceLineIndex;
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
				},
			});
		},
	};
}
