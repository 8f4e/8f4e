import type { SpriteFont, SpriteId } from '@8f4e/sprite-generator';
import type { DrawContext } from '@8f4e/web-ui';
import { vi } from 'vitest';

/** Creates a semantic lookup whose property names remain visible in drawer assertions. */
export function createSpriteIdLookupMock(): SpriteFont {
	return new Proxy(
		{ 63: 63 as SpriteId },
		{
			get: (target, key) => {
				if (typeof key === 'symbol') {
					return Reflect.get(target, key);
				}
				const numericKey = Number(key);
				return Number.isNaN(numericKey) ? key : numericKey;
			},
		}
	) as SpriteFont;
}

/** Creates the reusable numeric drawing surface expected by unit-scoped drawer tests. */
export function createDrawContextMock(): DrawContext {
	return {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawSprite: vi.fn(),
		drawText: vi.fn(),
		drawResolvedText: vi.fn(),
	} as unknown as DrawContext;
}
