import { gapCalculator, getTabStopsByLine, getVisualLineWidth, matchEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	getDeclarationsByByteAddress,
	getMemoryTargetAtSourceLine,
	isAddressAccess,
	prepareAddressBinding,
	prepareMemoryAccess,
	prepareNumericRead,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createWatchDirectiveData } from '../helpers/data';
import type { WatchDisplay, WatchValue } from '../types';

export function registerWatchLayout(
	layout: EditorLayoutRegistry,
	watchesByBlock: WeakMap<CodeBlockGraphicData, WatchValue[]>
): () => void {
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'watch', aliases: ['w'] }]).map(
			directive => createWatchDirectiveData(directive.args, directive.sourceLineIndex)
		);
		watchesByBlock.set(graphicData, []);
		const scope = getCodeBlockMemoryScope(graphicData);
		items.forEach(data => {
			const inlineTarget =
				data.inlineAccess && getMemoryTargetAtSourceLine(state, graphicData, data.lineNumber)?.target;
			const prepared = data.inlineAccess
				? inlineTarget && { target: inlineTarget, options: data.inlineAccess }
				: prepareMemoryAccess(state, scope, data.memoryId);
			if (!prepared) return;
			let display: WatchDisplay;
			if (isAddressAccess(prepared)) {
				const address = prepareAddressBinding(prepared);
				if (!address) return;
				display = { kind: 'address', address };
			} else {
				const read = prepareNumericRead(prepared);
				if (!read) return;
				if (!data.showEndAddress) display = { kind: 'value', read };
				else if (read.address.kind === 'fixed')
					display = { kind: 'address', address: { kind: 'fixed', byteAddress: prepared.target.memory.endByteAddress } };
				else {
					const base = prepareNumericRead({
						target: prepared.target,
						options: { ...prepared.options, bufferPointer: 0 },
					})!;
					display = {
						kind: 'endAddress',
						address: base.address,
						declarations: getDeclarationsByByteAddress(state.compiler.result.memoryPlan)!,
					};
				}
			}

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
