import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createCrossfadeDirectiveData } from '../helpers/data';
import type { Crossfade } from '../types';

export function registerCrossfadeLayout(
	layout: EditorLayoutRegistry,
	crossfadesByBlock: WeakMap<CodeBlockGraphicData, Crossfade[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock: graphicData, state }) => {
		const items = matchEditorDirectives(graphicData.parsedDirectives, [{ name: 'crossfade' }]).flatMap(directive => {
			const data = createCrossfadeDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		contribution.update(graphicData, {
			verticalSpaceAfterSourceLine: items.map(data => ({ sourceLineIndex: data.lineNumber, heightInRows: 2 })),
		});
		crossfadesByBlock.set(graphicData, []);
		items.forEach(data => {
			const scope = getCodeBlockMemoryScope(graphicData);
			const leftMemory = resolveMemoryIdentifier(state, scope, data.leftMemoryId);
			const rightMemory = resolveMemoryIdentifier(state, scope, data.rightMemoryId);

			if (!leftMemory || !rightMemory) {
				return;
			}

			const left = leftMemory.memory;
			const right = rightMemory.memory;

			if (
				left.isInteger ||
				right.isInteger ||
				left.isFloat64 ||
				right.isFloat64 ||
				left.numberOfElements !== 1 ||
				right.numberOfElements !== 1
			) {
				return;
			}

			const displayRow = graphicData.displayModel.sourceLineIndexToDisplayRow[data.lineNumber] ?? data.lineNumber;
			const width = graphicData.width - (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid;
			const handleWidth = Math.min(state.viewport.vGrid, width);
			const trackWidth = Math.max(width - handleWidth, 1);

			crossfadesByBlock.get(graphicData)!.push({
				width,
				height: state.viewport.hGrid * 2,
				x: (graphicData.lineNumberColumnWidth + 2) * state.viewport.vGrid,
				y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
				leftWordAddress: left.allocationUnitAddress,
				rightWordAddress: right.allocationUnitAddress,
				handleWidth,
				trackWidth,
				centerX: Math.floor(trackWidth / 2),
			});
		});
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
