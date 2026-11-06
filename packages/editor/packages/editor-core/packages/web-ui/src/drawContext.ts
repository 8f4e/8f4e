import type { PaletteIndex } from '@8f4e/editor-palette';
import { FILL_SPRITE_ID, type GlyphIds } from '@8f4e/sprite-generator';
import type { SpriteId } from 'glugglugglug';
import { DrawContext as SpriteDrawContext, type SpriteTarget } from 'glugglugglug/utils';
import type { SpriteCell } from './spriteCell';

/** Editor text/fill primitives bind shared shapes to explicit palette indices without per-frame allocations. */
export class DrawContext {
	private readonly sprites: SpriteDrawContext;
	constructor(
		target: SpriteTarget,
		private characterWidth: number
	) {
		this.sprites = new SpriteDrawContext(target);
	}
	setCharacterWidth(width: number): void {
		this.characterWidth = width;
	}
	drawSprite(x: number, y: number, spriteId: SpriteId, color: PaletteIndex, width?: number, height?: number): void {
		this.sprites.drawSprite(x, y, spriteId, color, width, height);
	}
	drawFill(x: number, y: number, color: PaletteIndex, width: number, height: number): void {
		this.drawSprite(x, y, FILL_SPRITE_ID, color, width, height);
	}
	/** Draw already prepared glyph IDs, preserving space cells without submitting them. */
	drawGlyphs(x: number, y: number, glyphs: GlyphIds, color: PaletteIndex): void {
		for (let index = 0; index < glyphs.length; index++) {
			const glyph = glyphs[index];
			if (glyph !== 32) this.drawSprite(x + index * this.characterWidth, y, glyph, color);
		}
	}
	/**
	 * Draw formatted live numbers using their ASCII character codes as glyph IDs.
	 * Trusts its inputs for performance: callers supply ASCII numeric text; no validation or Unicode mapping occurs.
	 */
	drawNumericText(x: number, y: number, text: string, color: PaletteIndex): void {
		for (let index = 0; index < text.length; index++) {
			const character = text.charCodeAt(index);
			if (character !== 32) this.drawSprite(x + index * this.characterWidth, y, character as SpriteId, color);
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
