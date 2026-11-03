import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createButtonDirectiveData } from '../helpers/data';
import type { ButtonWidget } from '../types';

export function registerButtonLayout(
	layout: EditorLayoutRegistry,
	buttonsByBlock: WeakMap<CodeBlockGraphicData, ButtonWidget[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'button' }]).flatMap(directive => {
			const data = createButtonDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		buttonsByBlock.set(graphicData, []);
		items.forEach(data => {
			const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), data.id)?.memory;
			if (!memory) return;
			const row = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			buttonsByBlock.get(graphicData)!.push({
				width: state.viewport.vGrid * 4,
				height: state.viewport.hGrid,
				x: graphicData.width - 4 * state.viewport.vGrid,
				y: gapCalculator(row, graphicData.gaps) * state.viewport.hGrid,
				allocationUnitAddress: memory.allocationUnitAddress,
				isInteger: memory.isInteger,
				offValue: data.offValue,
				onValue: data.onValue,
			});
		});
	});
	return unsubscribe;
}
