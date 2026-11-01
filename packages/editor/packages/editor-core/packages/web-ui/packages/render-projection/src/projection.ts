import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import deriveCodeBlockCodeCells from './deriveCodeBlockCodeCells';
import type { SpriteCell } from './spriteCell';

export interface CodeBlockRenderData {
	codeCells: Array<Array<SpriteCell | null>>;
}

export interface WebUiRenderData {
	codeBlocks: ReadonlyMap<number, CodeBlockRenderData>;
}

export interface WebUiRenderDataSource {
	getSnapshot: () => WebUiRenderData;
}

export interface WebUiRenderProjection extends WebUiRenderDataSource {
	dispose: () => void;
}

export default function createWebUiRenderProjection(
	store: StateManager<State>,
	events: Pick<EventDispatcher, 'on' | 'off'>
): WebUiRenderProjection {
	let snapshot: WebUiRenderData = { codeBlocks: new Map() };
	const refresh = () => {
		const state = store.getState();
		snapshot = {
			codeBlocks: new Map(
				state.codeBlockRendering.codeBlocks.map(block => [
					block.creationIndex,
					{ codeCells: deriveCodeBlockCodeCells(block) },
				])
			),
		};
	};

	events.on('codeBlockLayoutsChanged', refresh);
	refresh();

	return {
		getSnapshot: () => snapshot,
		dispose: () => {
			events.off('codeBlockLayoutsChanged', refresh);
		},
	};
}
