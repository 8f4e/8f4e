import { gapCalculator } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { BinaryControl, CodeBlockGraphicData, EditorDirectivePlugin } from '@8f4e/editor-state-types';
import { createSwitchDirectiveData } from './data';

export function createSwitchDirective(widgets: WeakMap<CodeBlockGraphicData, BinaryControl[]>): EditorDirectivePlugin {
	return {
		name: 'switch',
		clearGraphicData: codeBlock => {
			widgets.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createSwitchDirectiveData(directive.args, directive.rawRow);
			if (!data) return;
			draft.widgets.push({
				afterGraphicDataWidthCalculation: (codeBlock, state, derived) => {
					const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(codeBlock), data.id)?.memory;
					if (!memory) return;
					const row = derived.displayModel.rawRowToDisplayRow[data.lineNumber] ?? data.lineNumber;
					widgets.get(codeBlock)!.push({
						width: state.viewport.vGrid * 4,
						height: state.viewport.hGrid,
						x: codeBlock.width - 4 * state.viewport.vGrid,
						y: gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
						id: memory.id,
						allocationUnitAddress: memory.allocationUnitAddress,
						isInteger: memory.isInteger ?? true,
						offValue: data.offValue,
						onValue: data.onValue,
					});
				},
			});
		},
	};
}
