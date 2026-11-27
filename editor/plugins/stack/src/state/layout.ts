import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	displayRowToGridRow,
	getCompiledFunctionForCodeBlock,
	getCompiledModuleForCodeBlock,
	getVisualLineWidth,
	matchEditorDirectives,
	subscribeToBlockPreparation,
} from '@8f4e/editor-state';
import type { EditorCodeBlock, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { CompiledStackAnalysisLine } from '@8f4e/language-spec';
import { textToGlyphIds } from '@8f4e/web-ui';
import { formatStack } from '../helpers/formatStack';
import type { StackLabel } from '../types';

function getStackAnalysisLines(graphicData: EditorCodeBlock, state: State): CompiledStackAnalysisLine[] | undefined {
	if (graphicData.blockType === 'function') {
		return getCompiledFunctionForCodeBlock(graphicData, state)?.stackAnalysis;
	}

	return getCompiledModuleForCodeBlock(graphicData, state)?.stackAnalysis;
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

export function registerStackPreparation(
	store: EditorPluginContext['store'],
	layout: EditorLayoutRegistry,
	labelsByBlock: WeakMap<EditorCodeBlock, StackLabel[]>
): () => void {
	const unsubscribe = subscribeToBlockPreparation(
		store,
		layout,
		'compiler.result',
		({ codeBlock: graphicData, state }) => {
			const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'stack', aliases: ['s'] }]).filter(
				directive => directive.args.length === 0
			);
			labelsByBlock.set(graphicData, []);
			items.forEach(directive => {
				const stackAnalysisLines = getStackAnalysisLines(graphicData, state);
				if (!stackAnalysisLines) {
					return;
				}

				const sourceLineNumber = directive.isTrailing
					? graphicData.sourcePreparation
						? graphicData.sourcePreparation.instructionLineBySourceLine[directive.sourceLineIndex]
						: directive.sourceLineIndex
					: directive.sourceLineIndex;
				if (sourceLineNumber === undefined) return;
				const stackAnalysisLine = findStackAnalysisLine(stackAnalysisLines, sourceLineNumber, directive.isTrailing);
				if (!stackAnalysisLine) {
					return;
				}

				const displayRow =
					graphicData.displayModel.sourceLineIndexToDisplayRow[directive.sourceLineIndex] ?? directive.sourceLineIndex;
				const tabStopsByLine = graphicData.tabStopsByLine;
				const visualLineWidth = getVisualLineWidth(
					graphicData.code[directive.sourceLineIndex] || '',
					tabStopsByLine[directive.sourceLineIndex] || []
				);

				labelsByBlock.get(graphicData)!.push({
					x: state.viewport.vGrid * (3 + graphicData.lineNumberColumnWidth + visualLineWidth),
					y: displayRowToGridRow(displayRow, graphicData.gaps) * state.viewport.hGrid,
					glyphs: textToGlyphIds(formatStack(stackAnalysisLine.stackAnalysis.stackAfter)),
				});
			});
		}
	);
	return unsubscribe;
}
