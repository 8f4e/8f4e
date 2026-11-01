import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { parseTextureDirective, type TextureDirective } from './directive';

interface BlockTexture extends TextureDirective {
	x: number;
	y: number;
}

export function createTextureLayout(layout: EditorLayoutRegistry) {
	const viewsByBlock = new WeakMap<CodeBlockGraphicData, BlockTexture[]>();
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'texture' }]).flatMap(directive => {
			const data = parseTextureDirective(directive.args);
			const displayRow = codeBlock.displayModel.sourceLineIndexToDisplayRow[directive.sourceLineIndex];
			return data && displayRow !== undefined ? [{ data, line: directive.sourceLineIndex, displayRow }] : [];
		});
		const leftColumns = codeBlock.lineNumberColumnWidth + 2;
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items.map(({ data, line }) => ({
				sourceLineIndex: line,
				heightInRows: Math.ceil((data.crop.height * data.magnification) / state.viewport.hGrid),
			})),
			minGridWidth: items.length
				? leftColumns +
					Math.ceil(Math.max(...items.map(({ data }) => data.crop.width * data.magnification)) / state.viewport.vGrid) +
					1
				: undefined,
		});
		const usedRows = new Map<number, number>();
		viewsByBlock.set(
			codeBlock,
			items.map(({ data, line, displayRow }) => {
				const preceding = usedRows.get(line) ?? 0;
				usedRows.set(line, preceding + Math.ceil((data.crop.height * data.magnification) / state.viewport.hGrid));
				return {
					...data,
					x: leftColumns * state.viewport.vGrid,
					y: (gapCalculator(displayRow, codeBlock.gaps) + 1 + preceding) * state.viewport.hGrid,
				};
			})
		);
	});
	return {
		viewsByBlock,
		dispose: () => {
			unsubscribe();
			contribution.dispose();
		},
	};
}
