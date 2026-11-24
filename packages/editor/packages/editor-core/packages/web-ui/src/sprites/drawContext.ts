import type { PaletteIndex } from '@8f4e/editor-palette';
import { FILL_SPRITE_ID, type GlyphIds } from '@8f4e/sprite-generator';
import type { SpriteCell } from './spriteCell';

/** Receives viewport-relative sprite positions in pixels and optional destination sizes. */
export interface SpriteTarget {
	drawSprite(x: number, y: number, spriteId: number, color: PaletteIndex, width?: number, height?: number): void;
}

/** Translates editor-relative coordinates and submits glyphs, fills, and sprites to a target. */
export class DrawContext {
	private offsetX = 0;
	private offsetY = 0;
	private groupDepth = 0;
	private readonly groupX: number[] = [];
	private readonly groupY: number[] = [];

	constructor(
		private readonly target: SpriteTarget,
		private characterWidth: number
	) {}
	setCharacterWidth(width: number): void {
		this.characterWidth = width;
	}
	drawSprite(x: number, y: number, spriteId: number, color: PaletteIndex, width?: number, height?: number): void {
		this.target.drawSprite(x + this.offsetX, y + this.offsetY, spriteId, color, width, height);
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
			if (character !== 32) this.drawSprite(x + index * this.characterWidth, y, character, color);
		}
	}
	drawResolvedText(x: number, y: number, cells: readonly (SpriteCell | null)[]): void {
		for (let index = 0; index < cells.length; index++) {
			const cell = cells[index];
			if (cell !== null) this.drawSprite(x + index * this.characterWidth, y, cell & 0xffff, cell >>> 16);
		}
	}
	/** Adds a translation to the current group until the matching {@link endGroup}. */
	startGroup(x: number, y: number): void {
		// Retain stack storage across groups and frames.
		this.groupX[this.groupDepth] = this.offsetX;
		this.groupY[this.groupDepth] = this.offsetY;
		this.groupDepth++;
		this.offsetX += x;
		this.offsetY += y;
	}
	/** Restores the previous translation. Requires a matching {@link startGroup}. */
	endGroup(): void {
		this.groupDepth--;
		this.offsetX = this.groupX[this.groupDepth];
		this.offsetY = this.groupY[this.groupDepth];
	}
}
