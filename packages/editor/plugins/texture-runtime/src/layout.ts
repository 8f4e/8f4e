import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryTarget } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { parseTextureDirective, type TextureDirective } from './directive';

export interface BlockTexture extends TextureDirective {
	key: string;
	x: number;
	y: number;
	byteAddress: number | undefined;
}

export function registerTextureLayout(
	layout: EditorLayoutRegistry,
	texturesByBlock: WeakMap<CodeBlockGraphicData, BlockTexture[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'texture' }]).flatMap(
			(directive, index) => {
				const data = parseTextureDirective(directive.args);
				const displayRow = codeBlock.displayModel.sourceLineIndexToDisplayRow[directive.sourceLineIndex];
				return data && displayRow !== undefined ? [{ data, line: directive.sourceLineIndex, displayRow, index }] : [];
			}
		);
		const leftColumns = codeBlock.lineNumberColumnWidth + 2;
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items.map(({ data, line }) => ({
				sourceLineIndex: line,
				heightInRows: Math.ceil((data.height * data.magnification) / state.viewport.hGrid),
			})),
			minGridWidth: items.length
				? leftColumns +
					Math.ceil(Math.max(...items.map(({ data }) => data.width * data.magnification)) / state.viewport.vGrid) +
					1
				: undefined,
		});
		const rowsUsedByLine = new Map<number, number>();
		texturesByBlock.set(
			codeBlock,
			items.map(({ data, line, displayRow, index }) => {
				const target = resolveMemoryTarget(state, getCodeBlockMemoryScope(codeBlock), data.framebuffer);
				const precedingRows = rowsUsedByLine.get(line) ?? 0;
				rowsUsedByLine.set(line, precedingRows + Math.ceil((data.height * data.magnification) / state.viewport.hGrid));
				return {
					...data,
					key: `${codeBlock.creationIndex}:${index}`,
					x: leftColumns * state.viewport.vGrid,
					y: (gapCalculator(displayRow, codeBlock.gaps) + 1 + precedingRows) * state.viewport.hGrid,
					byteAddress:
						target && target.memory.elementByteLength >= data.byteLength ? target.memory.byteAddress : undefined,
				};
			})
		);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
