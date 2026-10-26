import { gapCalculator } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	resolveElementCount,
	resolveMemoryIdentifier,
	resolveTypedValueSpec,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createWaveDirectiveData } from '../helpers/data';
import type { Wave } from '../types';

export function createWaveDirectives(wavesByBlock: WeakMap<CodeBlockGraphicData, Wave[]>): EditorDirectiveDefinition[] {
	return [
		{ name: 'wave', heightRows: 2 },
		{ name: 'wave2', heightRows: 4 },
		{ name: 'wave4', heightRows: 8 },
	].map(({ name, heightRows }) => ({
		name,
		clearDerivedBlockData: codeBlock => {
			wavesByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createWaveDirectiveData(directive.args, directive.sourceLineIndex);
			if (!data) return;
			draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: heightRows });
			draft.layoutCallbacks.push({
				onBlockLayoutReady: (codeBlock, state, derived) => {
					const scope = getCodeBlockMemoryScope(codeBlock);
					const source = resolveMemoryIdentifier(state, scope, data.startAddressMemoryId);
					const elementCount = resolveElementCount(data.length, scope, state);
					const spec = source ? resolveTypedValueSpec(source) : undefined;
					if (!source || !elementCount || !spec) return;
					const row = derived.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
					wavesByBlock.get(codeBlock)!.push({
						width: codeBlock.width - (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
						height: state.viewport.hGrid * heightRows,
						x: (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
						y: (gapCalculator(row, codeBlock.gaps) + 1) * state.viewport.hGrid,
						source,
						elementCount,
						playhead: resolveMemoryIdentifier(state, scope, data.pointerMemoryId),
						inverseElementByteSize: 1 / spec.elementByteSize,
						baseSampleShift: spec.baseSampleShift,
						valueType: spec.valueType,
						minValue: spec.minValue,
						maxValue: spec.maxValue,
						inverseValueRange: 1 / (spec.maxValue - spec.minValue),
					});
				},
			});
		},
	}));
}
