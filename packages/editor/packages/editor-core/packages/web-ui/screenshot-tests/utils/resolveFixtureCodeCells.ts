import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { createSpriteCell, type SpriteCell, type SpriteFont } from '@8f4e/sprite-generator';
/** Resolve shared shapes and an explicit palette index into render-ready fixture cells. */
export default function resolveFixtureCodeCells(
	lines: string[],
	font: SpriteFont,
	color: PaletteIndex = PALETTE_INDICES.inkBase
): Array<Array<SpriteCell | null>> {
	return lines.map(line =>
		[...line].map((character): SpriteCell | null => {
			const code = character.charCodeAt(0);
			return code === 32 ? null : createSpriteCell(font[code] ?? font[63], color);
		})
	);
}
