import type { PaletteConfig } from '@8f4e/editor-palette';
import { SHADES } from '@8f4e/editor-palette';
import cga from '@8f4e/examples/modules/color-schemes/cgaColors.8f4em?raw';
import dx7 from '@8f4e/examples/modules/color-schemes/dx7.8f4em?raw';
import temple from '@8f4e/examples/modules/color-schemes/templeOs.8f4em?raw';
import aurora from '@8f4e/examples/projects/audio/amigaMods/hymn_to_aurora.8f4e?raw';
import blue from '@8f4e/examples/projects/misc/landingPageDemo1.8f4e?raw';
import green from '@8f4e/examples/projects/misc/landingPageDemo2.8f4e?raw';
import purple from '@8f4e/examples/projects/misc/landingPageDemo3.8f4e?raw';
import amber from '@8f4e/examples/projects/misc/landingPageDemo4.8f4e?raw';
import generateSprite, { resolveSpriteIds, type SpriteFont } from '@8f4e/sprite-generator';
import { Engine, LineDrawer } from 'glugglugglug';

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
	['Default', ''],
]) {
	const canvas = document.createElement('canvas');
	canvas.width = 248;
	canvas.height = 240;
	canvas.setAttribute('aria-label', name);
	document.body.append(canvas);
	const { spriteAtlas, palette } = await generateSprite({ font: 'ibmvga8x16', palette: paletteFromSource(source) });
	const engine = new Engine(canvas);
	const lines = new LineDrawer(engine);
	const ids = resolveSpriteIds(
		spriteAtlas.spriteIdentifiers,
		engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.lookup)
	);
	const text = (x: number, y: number, value: string, font: SpriteFont) => {
		for (const [index, character] of [...value].entries())
			engine.drawSprite(x + index * 8, y, font[character] ?? font[63]);
	};
	engine.renderFrame(() => {
		engine.drawSprite(0, 0, ids.background[0], canvas.width, canvas.height);
		engine.drawSprite(8, 24, ids.fillColors.surfaceBase, 232, 208);
		text(16, 32, name, ids.fontInkBase);
		text(16, 64, 'push', ids.fontPrimaryBase);
		text(64, 64, '42', ids.fontSecondaryBase);
		text(16, 80, '; supporting text', ids.fontTertiaryBase);
		engine.drawSprite(16, 112, ids.fillColors.surfaceRaised2, 208, 16);
		engine.drawSprite(16, 112, ids.fillColors.primaryDark2, 128, 16);
		engine.drawSprite(136, 112, ids.fillColors.inkBase, 16, 16);
		text(140, 112, '|', ids.fontInkOn);
		lines.drawLine(0, 100, 248, 100, 2, palette.rgba.strokeBase);
		engine.drawSprite(16, 136, ids.fillColors.darkSurface, 208, 20);
		for (let x = 0; x < 72; x++)
			engine.drawSprite(16 + x * 2, 145 + Math.round(Math.sin(x / 8) * 6), ids.fillColors.highlightBase, 2, 1);
		for (const [index, height] of [6, 12, 8, 16, 10].entries())
			engine.drawSprite(170 + index * 11, 155 - height, ids.fillColors.detailBase, 6, height);
		for (const [index, shade] of SHADES.entries())
			engine.drawSprite(16 + index * 23, 164, ids.fillColors[`primary${shade}`], 23, 12);
		engine.drawSprite(16, 184, ids.fillColors.floatingSurface, 96, 16);
		text(24, 184, 'Menu', ids.fontFloatingInk);
		engine.drawSprite(128, 184, ids.fillColors.inverseSurface, 96, 16);
		text(136, 184, 'Hint', ids.fontInverseInk);
		for (const [index, token] of (['positiveBase', 'warningBase', 'negativeBase'] as const).entries())
			engine.drawSprite(16 + index * 70, 208, ids.fillColors[token], 64, 16);
	});
}
document.body.dataset.ready = 'true';
