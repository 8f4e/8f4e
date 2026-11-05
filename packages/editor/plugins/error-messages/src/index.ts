import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator, wrapText } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockLayoutContext, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';

export function getCodeBlockErrors(state: State, codeBlock: CodeBlockGraphicData) {
	const projectScopePath = codeBlock.isProjectScope
		? codeBlock.projectPath
		: codeBlock.childProject
			? createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name)
			: undefined;
	return Object.values(state.codeErrors)
		.flat()
		.filter(
			error =>
				error.codeBlockId === codeBlock.creationIndex ||
				(projectScopePath !== undefined && error.projectGroupPath === projectScopePath)
		);
}

function prepareMessages(state: State, codeBlock: CodeBlockGraphicData) {
	const wrapWidth = Math.floor(codeBlock.width / state.viewport.vGrid) - 1;
	return getCodeBlockErrors(state, codeBlock).flatMap(error => {
		const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[error.lineNumber];
		return row === undefined
			? []
			: [
					{
						error,
						sourceLineIndex: error.lineNumber,
						row,
						lines: [' Error:', ...wrapText(error.message, wrapWidth).map(line => ' ' + line)],
					},
				];
	});
}

function positionMessages(state: State, codeBlock: CodeBlockGraphicData, messages = prepareMessages(state, codeBlock)) {
	const remainingRows = new Map<number, number>();
	for (const message of messages)
		remainingRows.set(message.row, (remainingRows.get(message.row) ?? 0) + message.lines.length);
	return messages.map(message => {
		const remaining = remainingRows.get(message.row)!;
		// Place messages at the end of the row's gap, after other contributed content.
		const y = (gapCalculator(message.row + 1, codeBlock.gaps) - remaining) * state.viewport.hGrid;
		remainingRows.set(message.row, remaining - message.lines.length);
		return { ...message, y };
	});
}

/** Read-only world-space rectangles for the messages in the block's settled layout. */
export function getErrorMessageBounds(state: State, codeBlock: CodeBlockGraphicData) {
	return positionMessages(state, codeBlock).map(({ error, lines, y }) => ({
		error,
		x: codeBlock.x,
		y: codeBlock.y + y,
		width: codeBlock.width,
		height: lines.length * state.viewport.hGrid,
	}));
}

export const errorMessagesPlugin: EditorPlugin = {
	id: 'error-messages',
	setup: ({ store, layout, drawers }) => {
		const messagesByBlock = new WeakMap<CodeBlockGraphicData, Array<{ lines: string[]; y: number }>>();
		const contribution = layout.createContribution();
		const prepare = ({ codeBlock, state }: CodeBlockLayoutContext) => {
			const messages = prepareMessages(state, codeBlock);
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: messages.map(message => ({
					sourceLineIndex: message.sourceLineIndex,
					heightInRows: message.lines.length,
				})),
			});

			messagesByBlock.set(codeBlock, positionMessages(state, codeBlock, messages));
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
