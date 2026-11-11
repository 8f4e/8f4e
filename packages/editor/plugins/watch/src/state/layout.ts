import { gapCalculator, getTabStopsByLine, getVisualLineWidth, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, getMemoryTargetAtSourceLine } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createWatchDirectiveData } from '../helpers/data';
import { prepareWatchDisplay } from '../helpers/prepareDisplay';
import type { WatchValue } from '../types';

export function registerWatchLayout(
	layout: EditorLayoutRegistry,
	watchesByBlock: WeakMap<CodeBlockGraphicData, WatchValue[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'watch', aliases: ['w'] }])
			.map(directive => createWatchDirectiveData(directive.args, directive.sourceLineIndex))
			.filter(data => data !== undefined);
		watchesByBlock.set(graphicData, []);
		const scope = getCodeBlockMemoryScope(graphicData);
		items.forEach(data => {
			const inlineTarget =
				data.target.kind === 'inline' || data.target.kind === 'inline-end'
					? getMemoryTargetAtSourceLine(state, graphicData, data.lineNumber)?.target
					: undefined;
			const display = prepareWatchDisplay(state, scope, data.target, inlineTarget);
			if (!display) return;

			const displayRow = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			const tabStopsByLine = getTabStopsByLine(graphicData.code);
			const visualLineWidth = getVisualLineWidth(
				graphicData.code[data.lineNumber] || '',
				tabStopsByLine[data.lineNumber] || []
			);

			watchesByBlock.get(graphicData)!.push({
				x: state.viewport.vGrid * (3 + graphicData.lineNumberColumnWidth + visualLineWidth),
				y: gapCalculator(displayRow, graphicData.gaps) * state.viewport.hGrid,
				display,
				displayFormat: data.displayFormat,
			});
		});
	});
	return unsubscribe;
}
