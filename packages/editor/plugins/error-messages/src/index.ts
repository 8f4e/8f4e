import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator, wrapText } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockLayoutContext } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';

export const errorMessagesPlugin: EditorPlugin = {
	id: 'error-messages',
	setup: ({ store, layout, drawers }) => {
		const messagesByBlock = new WeakMap<CodeBlockGraphicData, Array<{ lines: string[]; y: number }>>();
		const contribution = layout.createContribution();
		const prepare = ({ codeBlock, state }: CodeBlockLayoutContext) => {
			const projectScopePath = codeBlock.isProjectScope
				? codeBlock.projectPath
				: codeBlock.childProject
					? createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name)
					: undefined;
			const wrapWidth = Math.floor(codeBlock.width / state.viewport.vGrid) - 1;
			const messages = Object.values(state.codeErrors)
				.flat()
				.filter(
					error =>
						error.codeBlockId === codeBlock.creationIndex ||
						(projectScopePath !== undefined && error.projectGroupPath === projectScopePath)
				)
				.flatMap(error => {
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

			const heights = new Map<number, number>();
			for (const message of messages) heights.set(message.row, (heights.get(message.row) ?? 0) + message.lines.length);
			const offsets = new Map<number, number>();
			messagesByBlock.set(
				codeBlock,
				messages.map(({ row, lines }) => {
					const offset = offsets.get(row) ?? 0;
					offsets.set(row, offset + lines.length);
					// Place messages at the end of the row's gap, after other contributed content.
					const start = gapCalculator(row + 1, codeBlock.gaps) - heights.get(row)!;
					return { lines, y: (start + offset) * state.viewport.hGrid };
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
