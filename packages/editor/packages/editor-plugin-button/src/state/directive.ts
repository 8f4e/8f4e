import { gapCalculator } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectivePlugin } from '@8f4e/editor-state-types';
import { createButtonDirectiveData } from '../helpers/data';
import type { ButtonWidget } from '../types';

export function createButtonDirective(widgets: WeakMap<CodeBlockGraphicData, ButtonWidget[]>): EditorDirectivePlugin {
	return {
		name: 'button',
		clearGraphicData: codeBlock => {
			widgets.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createButtonDirectiveData(directive.args, directive.rawRow);
			if (!data) return;
			draft.widgets.push({
				onBlockLayoutReady: (codeBlock, state, derived) => {
					const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(codeBlock), data.id)?.memory;
					if (!memory) return;
					const row = derived.displayModel.rawRowToDisplayRow[data.lineNumber] ?? data.lineNumber;
					widgets.get(codeBlock)!.push({
						width: state.viewport.vGrid * 4,
						height: state.viewport.hGrid,
						x: codeBlock.width - 4 * state.viewport.vGrid,
						y: gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
						allocationUnitAddress: memory.allocationUnitAddress,
						isInteger: memory.isInteger,
						offValue: data.offValue,
						onValue: data.onValue,
					});
				},
			});
		},
	};
}
