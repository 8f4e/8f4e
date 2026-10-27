import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import generateSprite from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';

const output = document.querySelector<HTMLCanvasElement>('#test-canvas');
if (!output) {
	throw new Error('Could not find the sprite atlas test canvas.');
}

const { characterHeight, characterWidth, spriteAtlas } = await generateSprite({ font: 'ibmvga8x16' });
const engine = new Engine(output, { initialCapacity: 4 });
engine.setPalette(toPaletteBytes(resolvePalette()));
engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.grid);
const ids = spriteAtlas.sprites;
engine.renderFrame(() => {
	engine.drawSprite(0, 0, ids.fill, PALETTE_INDICES.canvasBase, output.width, output.height);
	engine.drawSprite(32, 32, ids.fill, PALETTE_INDICES.surfaceBase, 640, 208);

	for (const [index, character] of [...'SPRITE ATLAS'].entries()) {
		engine.drawSprite(
			48 + index * characterWidth * 2,
			48,
			ids.font[character.charCodeAt(0)],
			PALETTE_INDICES.primaryBase,
			characterWidth * 2,
			characterHeight * 2
		);
	}

	for (const [index, character] of [...'one atlas / numeric ids / one draw list'].entries()) {
		engine.drawSprite(48 + index * characterWidth, 112, ids.font[character.charCodeAt(0)], PALETTE_INDICES.inkBase);
	}

	for (const [index, character] of [...'sprite-generator atlas'].entries()) {
		engine.drawSprite(48 + index * characterWidth, 144, ids.font[character.charCodeAt(0)], PALETTE_INDICES.mutedBase);
	}

	engine.drawSprite(48, 184, ids.fill, PALETTE_INDICES.primarySoft, 448, characterHeight);
	for (const [index, character] of [...'ordered and pixelated'].entries()) {
		engine.drawSprite(48 + index * characterWidth, 184, ids.font[character.charCodeAt(0)], PALETTE_INDICES.primaryBase);
	}
});

document.body.dataset.ready = 'true';
