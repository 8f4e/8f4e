import { gapCalculator, parseEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createSwitchDirectiveData } from './data';

export interface SwitchWidget {
	x: number;
	y: number;
	width: number;
	height: number;
	allocationUnitAddress: number;
	isInteger: boolean;
	offValue: number;
	onValue: number;
}

export function registerSwitchLayout(
	layout: EditorLayoutRegistry,
	widgets: WeakMap<CodeBlockGraphicData, SwitchWidget[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = parseEditorDirectives(graphicData.code, [{ name: 'switch' }]).flatMap(directive => {
			const data = createSwitchDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		widgets.set(graphicData, []);
		items.forEach(data => {
			const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(graphicData), data.id)?.memory;
			if (!memory) return;
			const row = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			widgets.get(graphicData)!.push({
				width: state.viewport.vGrid * 4,
				height: state.viewport.hGrid,
				x: graphicData.width - 4 * state.viewport.vGrid,
				y: gapCalculator(row, graphicData.gaps) * state.viewport.hGrid,
				allocationUnitAddress: memory.allocationUnitAddress,
				isInteger: memory.isInteger ?? true,
				offValue: data.offValue,
				onValue: data.onValue,
			});
		});
	});
	return unsubscribe;
}
