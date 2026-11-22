import { FILL_SPRITE_ID, textToGlyphIds } from '@8f4e/sprite-generator';
import { expect, it } from 'vitest';
import { AsciiRenderer } from './index';

it('does not overwrite visible text with clipped or transparent sprites, and clears between frames', () => {
	const renderer = new AsciiRenderer(3, 1);
	renderer.setPalette(Uint8Array.of(255, 255, 255, 255, 0, 0, 0, 0));
	const phases: string[] = [];
	renderer.hooks.preDraw.push(() => phases.push('pre'));
	renderer.hooks.postDraw.push(() => phases.push('post'));
	renderer.renderFrame(() => {
		phases.push('sprites');
		renderer.drawSprite(-1, 0, 65, 0, 3);
		renderer.drawSprite(-2, 0, 66, 0);
		renderer.drawSprite(1, 0, 32, 0);
		renderer.drawSprite(0, 0, FILL_SPRITE_ID, 1);
		renderer.drawSprite(2, 0, 130, 0);
	});
	expect(renderer.toText()).toBe('AA?');
	expect(phases).toEqual(['pre', 'sprites', 'post']);
	renderer.resize(2, 1);
	renderer.renderFrame(() => {});
	expect(renderer.toText()).toBe('  ');
});

it('represents CP437 pointers and arrows by their ASCII directions in scene snapshots', () => {
	const renderer = new AsciiRenderer(8, 1);
	renderer.setPalette(Uint8Array.of(255, 255, 255, 255));
	renderer.renderFrame(() => {
		textToGlyphIds('►→◄←▲↑▼↓').forEach((glyph, x) => renderer.drawSprite(x, 0, glyph, 0));
	});
	expect(renderer.toText()).toBe('>><<^^vv');
});
