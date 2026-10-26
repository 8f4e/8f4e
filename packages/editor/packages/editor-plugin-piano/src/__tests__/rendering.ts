import type { DrawContext } from '@8f4e/web-ui';
import { vi } from 'vitest';

/** Creates the reusable numeric drawing surface expected by unit-scoped drawer tests. */
export function createDrawContextMock(): DrawContext {
	return {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawSprite: vi.fn(),
		drawFill: vi.fn(),
		drawCharacter: vi.fn(),
		drawText: vi.fn(),
		drawResolvedText: vi.fn(),
	} as unknown as DrawContext;
}
