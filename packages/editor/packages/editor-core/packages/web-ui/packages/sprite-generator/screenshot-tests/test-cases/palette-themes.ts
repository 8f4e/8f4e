import type { PaletteConfig } from '@8f4e/editor-palette';
import { PALETTE_INDICES, type PaletteIndex, resolvePalette, SHADES, toPaletteBytes } from '@8f4e/editor-palette';
import cga from '@8f4e/examples/modules/color-schemes/cgaColors.8f4em?raw';
import dx7 from '@8f4e/examples/modules/color-schemes/dx7.8f4em?raw';
import temple from '@8f4e/examples/modules/color-schemes/templeOs.8f4em?raw';
import aftertouch from '@8f4e/examples/projects/audio/amigaMods/aftertouch.8f4e?raw';
import aurora from '@8f4e/examples/projects/audio/amigaMods/hymn_to_aurora.8f4e?raw';
import translucent from '@8f4e/examples/projects/audio/amigaMods/lowerIntentions.8f4e?raw';
import sampler from '@8f4e/examples/projects/audio/samplePlayer.8f4e?raw';
import classifier from '@8f4e/examples/projects/machine-learning/digitClassifier.8f4e?raw';
import blue from '@8f4e/examples/projects/misc/landingPageDemo1.8f4e?raw';
import green from '@8f4e/examples/projects/misc/landingPageDemo2.8f4e?raw';
import purple from '@8f4e/examples/projects/misc/landingPageDemo3.8f4e?raw';
import amber from '@8f4e/examples/projects/misc/landingPageDemo4.8f4e?raw';
import loadFontAtlas, { FILL_SPRITE_ID, getGlyphSpriteId } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';

function paletteFromSource(source: string): PaletteConfig {
	return Object.fromEntries(
		[...source.matchAll(/; @config color\.(\w+)\s+([^\n]+)/gi)].map(match => [match[1], match[2]])
	);
}

for (const [name, source] of [
	['Aurora', aurora],
	['Blue', blue],
	['Green', green],
	['Purple', purple],
	['Amber', amber],
	['CGA', cga],
	['TempleOS', temple],
	['DX7', dx7],
	['Aftertouch', aftertouch],
	['Classifier', classifier],
	['Sampler', sampler],
	['Lower Intentions', translucent],
]) {
	const canvas = document.createElement('canvas');
	canvas.width = 248;
	canvas.height = 240;
	canvas.setAttribute('aria-label', name);
	document.body.append(canvas);
	const spriteAtlas = await loadFontAtlas('ibmvga8x16');
	const { cellWidth: characterWidth, cellHeight: characterHeight } = spriteAtlas.grid;
	const dotSize = 2;
	const palette = resolvePalette(paletteFromSource(source));
	const engine = new Engine(canvas);
	engine.setPalette(toPaletteBytes(palette));
	engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.grid);
	const text = (x: number, y: number, value: string, color: PaletteIndex) => {
		for (const [index, character] of [...value].entries())
			engine.drawSprite(x + index * 8, y, getGlyphSpriteId(character.charCodeAt(0)), color);
	};
	engine.renderFrame(() => {
		engine.drawSprite(0, 0, FILL_SPRITE_ID, PALETTE_INDICES.canvasBase, canvas.width, canvas.height);
		// This static generator preview composes dots from fill cells; web-ui draws the pattern procedurally.
		for (let x = 0, column = 0; x < canvas.width; x += characterWidth, column++) {
			for (let y = 0; y < canvas.height; y += characterHeight) {
				engine.drawSprite(
					x + (characterWidth - dotSize) / 2,
					y + (characterHeight - dotSize) / 2,
					FILL_SPRITE_ID,
					column % 2 === 0 ? PALETTE_INDICES.canvasDetail2 : PALETTE_INDICES.canvasDetail1,
					dotSize,
					dotSize
				);
			}
		}
		engine.drawSprite(8, 24, FILL_SPRITE_ID, PALETTE_INDICES.surfaceBase, 232, 208);
		text(16, 32, name, PALETTE_INDICES.inkStrong);
		text(16, 64, 'push', PALETTE_INDICES.primaryBase);
		text(64, 64, '42', PALETTE_INDICES.secondaryBase);
		text(96, 64, '0b', PALETTE_INDICES.secondarySoft);
		text(112, 64, '0', PALETTE_INDICES.mutedSoft);
		text(120, 64, '1', PALETTE_INDICES.primaryStrong);
		text(16, 80, '; supporting text', PALETTE_INDICES.tertiaryBase);
		engine.drawSprite(16, 112, FILL_SPRITE_ID, PALETTE_INDICES.surfaceOverlay, 208, 16);
		engine.drawSprite(16, 112, FILL_SPRITE_ID, PALETTE_INDICES.accentSurface, 128, 16);
		engine.drawSprite(136, 112, FILL_SPRITE_ID, PALETTE_INDICES.lightBase, 16, 16);
		text(140, 112, '|', PALETTE_INDICES.darkBase);
		engine.drawSprite(0, 99, FILL_SPRITE_ID, PALETTE_INDICES.strokeBase, 248, 2);
		engine.drawSprite(16, 136, FILL_SPRITE_ID, PALETTE_INDICES.darkSurface, 208, 20);
		for (let x = 0; x < 72; x++)
			engine.drawSprite(
				16 + x * 2,
				145 + Math.round(Math.sin(x / 8) * 6),
				FILL_SPRITE_ID,
				PALETTE_INDICES.highlightBase,
				2,
				1
			);
		for (const [index, height] of [6, 12, 8, 16, 10].entries())
			engine.drawSprite(170 + index * 11, 155 - height, FILL_SPRITE_ID, PALETTE_INDICES.detailBase, 6, height);
		for (const [index, shade] of SHADES.entries())
			engine.drawSprite(16 + index * 23, 164, FILL_SPRITE_ID, PALETTE_INDICES[`primary${shade}`], 23, 12);
		engine.drawSprite(16, 184, FILL_SPRITE_ID, PALETTE_INDICES.floatingSurface, 96, 16);
		text(24, 184, 'Menu', PALETTE_INDICES.floatingInk);
		engine.drawSprite(128, 184, FILL_SPRITE_ID, PALETTE_INDICES.inverseSurface, 96, 16);
		text(136, 184, 'Hint', PALETTE_INDICES.inverseInk);
		for (const [index, token] of (['positiveBase', 'warningBase', 'negativeBase'] as const).entries())
			engine.drawSprite(16 + index * 70, 208, FILL_SPRITE_ID, PALETTE_INDICES[token], 64, 16);
	});
}
document.body.dataset.ready = 'true';
