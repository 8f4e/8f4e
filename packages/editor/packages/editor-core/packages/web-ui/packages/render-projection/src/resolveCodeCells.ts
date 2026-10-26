import type { PaletteIndex } from '@8f4e/editor-palette';
import { createSpriteCell, type SpriteCell, type SpriteFont } from '@8f4e/sprite-generator';

/** Resolve shared glyph IDs and palette transitions once, outside the frame submission loop. */
export default function resolveCodeCells(
	characters: ReadonlyArray<ReadonlyArray<number>>,
	colorTransitions: ReadonlyArray<ReadonlyArray<PaletteIndex | undefined>>,
	defaultColor: PaletteIndex,
	disabledColor: PaletteIndex | undefined,
	font: SpriteFont
): Array<Array<SpriteCell | null>> {
	return characters.map((line, row) => {
		let color = disabledColor ?? defaultColor;
		return line.map((character, column): SpriteCell | null => {
			const nextColor = colorTransitions[row]?.[column];
			if (disabledColor === undefined && nextColor !== undefined) color = nextColor;
			if (character === 32) return null;
			return createSpriteCell(font[character] ?? font[63], color);
		});
	});
}
