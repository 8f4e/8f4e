import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator, getCodeBlockErrors, wrapText } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockLayoutContext } from '@8f4e/editor-state-types';

export const errorMessagesPlugin: EditorPlugin = {
	id: 'error-messages',
	setup: ({ store, layout, drawers }) => {
		const messagesByBlock = new WeakMap<CodeBlockGraphicData, Array<{ lines: string[]; y: number }>>();
		const contribution = layout.createContribution();
		const prepare = ({ codeBlock, state }: CodeBlockLayoutContext) => {
			const wrapWidth = Math.floor(codeBlock.width / state.viewport.vGrid) - 1;
			const messages = getCodeBlockErrors(state, codeBlock).flatMap(error => {
				const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[error.lineNumber];
				return row === undefined
					? []
					: [
							{
								sourceLineIndex: error.lineNumber,
								row,
								lines: [' Error:', ...wrapText(error.message, wrapWidth).map(line => ' ' + line)],
							},
						];
			});
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: messages.map(message => ({
					sourceLineIndex: message.sourceLineIndex,
					heightInRows: message.lines.length,
				})),
			});
			const remainingRows = new Map<number, number>();
			for (const message of messages)
				remainingRows.set(message.row, (remainingRows.get(message.row) ?? 0) + message.lines.length);
			messagesByBlock.set(
				codeBlock,
				messages.map(({ row, lines }) => {
					const remaining = remainingRows.get(row)!;
					// Place messages at the end of the row's gap, after other contributed content.
					const y = (gapCalculator(row + 1, codeBlock.gaps) - remaining) * state.viewport.hGrid;
					remainingRows.set(row, remaining - lines.length);
					return { lines, y };
				})
			);
		};
		const refresh = () => {
			const state = store.getState();
			for (const codeBlock of state.codeBlockRendering.currentProject.blocks) prepare({ codeBlock, state });
		};
		const unsubscribeLayout = layout.subscribe(prepare);
		store.subscribe('codeErrors', refresh);
		const removeDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, state }) => {
			for (const { lines, y } of messagesByBlock.get(codeBlock) ?? []) {
				draw.drawFill(0, y, PALETTE_INDICES.negativeSurface, codeBlock.width, lines.length * state.viewport.hGrid);
				lines.forEach((line, row) =>
					draw.drawText(0, y + row * state.viewport.hGrid, line, PALETTE_INDICES.negativeOn)
				);
			}
		});
		return () => {
			store.unsubscribe('codeErrors', refresh);
			unsubscribeLayout();
			removeDrawer();
			contribution.dispose();
		};
	},
};
