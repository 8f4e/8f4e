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

	const selectors = ['codeBlockRendering', 'codeErrors', 'assertionResults', 'compiler.isCompiling'] as const;
	for (const selector of selectors) store.subscribe(selector, refresh);
	// Font changes can change plugin-created logical gaps even though glyph IDs stay fixed.
	const eventNames = ['memoryValuesChanged', 'spriteSheetRerendered', 'codeBlockLayoutsChanged'] as const;
	for (const eventName of eventNames) events.on(eventName, refresh);
	refresh();

	return {
		getSnapshot: () => snapshot,
		dispose: () => {
			for (const selector of selectors) store.unsubscribe(selector, refresh);
			for (const eventName of eventNames) events.off(eventName, refresh);
		},
	};
}
