import { vi } from 'vitest';
import type { DrawContext } from '../drawContext';

/** Creates the reusable numeric drawing surface expected by unit-scoped drawer tests. */
export function createDrawContextMock(): DrawContext {
	return {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawSprite: vi.fn(),
		drawFill: vi.fn(),
		drawGlyphs: vi.fn(),
		drawResolvedText: vi.fn(),
	} as unknown as DrawContext;
}
