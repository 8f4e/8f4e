import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { getGlyphSpriteId } from '@8f4e/sprite-generator';
import { createSpriteCell, type SpriteCell } from '@8f4e/web-ui-render-projection';
/** Resolve shared shapes and an explicit palette index into render-ready fixture cells. */
export default function resolveFixtureCodeCells(
	lines: string[],
	color: PaletteIndex = PALETTE_INDICES.inkBase
): Array<Array<SpriteCell | null>> {
	return lines.map(line =>
		[...line].map((character): SpriteCell | null => {
			const code = character.charCodeAt(0);
			return code === 32 ? null : createSpriteCell(getGlyphSpriteId(code), color);
		})
	);
}
