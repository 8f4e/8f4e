import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { SpriteCell } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';
import deriveCodeBlockCodeCells from './deriveCodeBlockCodeCells';

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
	refresh: () => void;
	dispose: () => void;
}

export default function createWebUiRenderProjection(
	store: StateManager<State>,
	events: Pick<EventDispatcher, 'on' | 'off'>
): WebUiRenderProjection {
	let snapshot: WebUiRenderData = { codeBlocks: new Map() };
	const refresh = () => {
		const state = store.getState();
		const spriteLookups = state.spriteLookups;
		if (!spriteLookups) {
			snapshot = { codeBlocks: new Map() };
			return;
		}
		snapshot = {
			codeBlocks: new Map(
				state.codeBlockRendering.codeBlocks.map(block => [
					block.creationIndex,
					{ codeCells: deriveCodeBlockCodeCells(block, spriteLookups) },
				])
			),
		};
	};

	const selectors = ['codeBlockRendering', 'spriteLookups', 'codeErrors', 'info'] as const;
	for (const selector of selectors) store.subscribe(selector, refresh);
	const eventNames = ['runtimeInitialized', 'spriteSheetRerendered'] as const;
	for (const eventName of eventNames) events.on(eventName, refresh);
	refresh();

	return {
		getSnapshot: () => snapshot,
		refresh,
		dispose: () => {
			for (const selector of selectors) store.unsubscribe(selector, refresh);
			for (const eventName of eventNames) events.off(eventName, refresh);
		},
	};
}
