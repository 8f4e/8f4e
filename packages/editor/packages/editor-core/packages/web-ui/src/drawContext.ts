import type { PaletteIndex } from '@8f4e/editor-palette';
import type { SpriteCell, SpriteId, SpriteIdLookups } from '@8f4e/sprite-generator';
import { DrawContext as SpriteDrawContext, type SpriteTarget } from 'glugglugglug/utils';

/** Editor text/fill primitives bind shared shapes to explicit palette indices without per-frame allocations. */
export class DrawContext {
	private readonly sprites: SpriteDrawContext;
	constructor(
		target: SpriteTarget,
		private characterWidth: number,
		private lookups: SpriteIdLookups
	) {
		this.sprites = new SpriteDrawContext(target);
	}
	setCharacterWidth(width: number): void {
		this.characterWidth = width;
	}
	setSpriteLookups(lookups: SpriteIdLookups): void {
		this.lookups = lookups;
	}
	drawSprite(x: number, y: number, spriteId: SpriteId, color: PaletteIndex, width?: number, height?: number): void {
		this.sprites.drawSprite(x, y, spriteId, color, width, height);
	}
	drawFill(x: number, y: number, color: PaletteIndex, width: number, height: number): void {
		this.drawSprite(x, y, this.lookups.fill, color, width, height);
	}
	drawCharacter(x: number, y: number, character: number, color: PaletteIndex, width?: number, height?: number): void {
		this.drawSprite(x, y, this.lookups.font[character] ?? this.lookups.font[63], color, width, height);
	}
	drawText(x: number, y: number, text: string, color: PaletteIndex): void {
		for (let index = 0; index < text.length; index++) {
			const character = text.charCodeAt(index);
			if (character !== 32) this.drawCharacter(x + index * this.characterWidth, y, character, color);
		}
	}
	drawResolvedText(x: number, y: number, cells: readonly (SpriteCell | null)[]): void {
		for (let index = 0; index < cells.length; index++) {
			const cell = cells[index];
			if (cell !== null) this.drawSprite(x + index * this.characterWidth, y, (cell & 0xffff) as SpriteId, cell >>> 16);
		}
	}
	startGroup(x: number, y: number): void {
		this.sprites.startGroup(x, y);
	}
	endGroup(): void {
		this.sprites.endGroup();
	}
}
