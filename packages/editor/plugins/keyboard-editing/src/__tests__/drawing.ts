import type { CodeBlockDrawerContext, CodeBlockGraphicData, State } from '@8f4e/editor-core';
import type { DrawContext } from '@8f4e/web-ui';
import { vi } from 'vitest';

export function createDrawingContext(state: State, codeBlock: CodeBlockGraphicData) {
	const draw = { drawGlyphs: vi.fn() };
	const context: CodeBlockDrawerContext = {
		draw: draw as unknown as DrawContext,
		state,
		codeBlock,
		memoryViews: {
			int8: new Int8Array(0),
			int16: new Int16Array(0),
			int32: new Int32Array(0),
			uint8: new Uint8Array(0),
			uint16: new Uint16Array(0),
			float32: new Float32Array(0),
			float64: new Float64Array(0),
		},
	};
	return { draw, context };
}
