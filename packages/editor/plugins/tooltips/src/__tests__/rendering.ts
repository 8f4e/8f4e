import { DrawContext } from '@8f4e/web-ui';
import { vi } from 'vitest';

/** Creates the reusable numeric drawing surface expected by unit-scoped drawer tests. */
export function createDrawContextMock(): DrawContext {
	const draw = new DrawContext({ drawSprite: vi.fn() }, 8);
	for (const method of ['startGroup', 'endGroup', 'drawSprite', 'drawFill', 'drawGlyphs', 'drawResolvedText'] as const)
		vi.spyOn(draw, method).mockImplementation(() => {});
	vi.spyOn(draw, 'drawNumericText');
	return draw;
}
