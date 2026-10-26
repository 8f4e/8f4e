import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';
import type { MemoryViews } from '../types';

export interface CodeBlockDrawerContext {
	/** Drawing coordinates are relative to the visible code block. */
	draw: DrawContext;
	state: State;
	codeBlock: CodeBlockGraphicData;
	memoryViews: MemoryViews;
}

export type CodeBlockDrawer = (context: CodeBlockDrawerContext) => void;

export interface EditorDrawerRegistry {
	registerCodeBlockDrawer: (drawer: CodeBlockDrawer) => () => void;
}

export interface CodeBlockDrawerRegistry extends EditorDrawerRegistry {
	drawCodeBlock: CodeBlockDrawer;
}

export function createCodeBlockDrawerRegistry(): CodeBlockDrawerRegistry {
	const registrations = new Set<{ drawer: CodeBlockDrawer }>();
	return {
		registerCodeBlockDrawer: drawer => {
			const registration = { drawer };
			registrations.add(registration);
			return () => {
				registrations.delete(registration);
			};
		},
		drawCodeBlock: context => {
			for (const { drawer } of registrations) drawer(context);
		},
	};
}
