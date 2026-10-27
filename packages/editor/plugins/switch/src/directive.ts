import { gapCalculator } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
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

export function createSwitchDirective(
	widgets: WeakMap<CodeBlockGraphicData, SwitchWidget[]>
): EditorDirectiveDefinition {
	return {
		name: 'switch',
		clearDerivedBlockData: codeBlock => {
			widgets.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createSwitchDirectiveData(directive.args, directive.sourceLineIndex);
			if (!data) return;
			draft.layoutCallbacks.push({
				onBlockLayoutReady: (codeBlock, state, derived) => {
					const memory = resolveMemoryIdentifier(state, getCodeBlockMemoryScope(codeBlock), data.id)?.memory;
					if (!memory) return;
					const row = derived.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
					widgets.get(codeBlock)!.push({
						width: state.viewport.vGrid * 4,
						height: state.viewport.hGrid,
						x: codeBlock.width - 4 * state.viewport.vGrid,
						y: gapCalculator(row, codeBlock.gaps) * state.viewport.hGrid,
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
