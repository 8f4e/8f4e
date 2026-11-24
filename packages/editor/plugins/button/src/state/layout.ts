import type { EditorPluginContext } from '@8f4e/editor-core';
import { displayRowToGridRow, matchEditorDirectives, subscribeToBlockPreparation } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryAddress } from '@8f4e/editor-state/memory';
import type { EditorCodeBlock, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createButtonDirectiveData } from '../helpers/data';
import type { ButtonWidget } from '../types';

export function registerButtonPreparation(
	store: EditorPluginContext['store'],
	layout: EditorLayoutRegistry,
	buttonsByBlock: WeakMap<EditorCodeBlock, ButtonWidget[]>
): () => void {
	const unsubscribe = subscribeToBlockPreparation(
		store,
		layout,
		'compiler.result',
		({ codeBlock: graphicData, state }) => {
			const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'button' }]).flatMap(directive => {
				const data = createButtonDirectiveData(directive.args, directive.sourceLineIndex);
				return data ? [data] : [];
			});
			buttonsByBlock.set(graphicData, []);
			items.forEach(data => {
				const memory = resolveMemoryAddress(state, getCodeBlockMemoryScope(graphicData), data.id)?.memory;
				if (!memory) return;
				const row = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
				buttonsByBlock.get(graphicData)!.push({
					width: state.viewport.vGrid * 4,
					height: state.viewport.hGrid,
					x: graphicData.width - 4 * state.viewport.vGrid,
					y: displayRowToGridRow(row, graphicData.gaps) * state.viewport.hGrid,
					allocationUnitAddress: memory.allocationUnitAddress,
					isInteger: memory.isInteger,
					offValue: data.offValue,
					onValue: data.onValue,
				});
			});
		}
	);
	return unsubscribe;
}
