import type { SpriteFont, SpriteId } from '@8f4e/sprite-generator';

/** Resolve fixture text into render-ready cells using an explicitly selected font. */
export default function resolveFixtureCodeCells(lines: string[], font: SpriteFont): Array<Array<SpriteId | null>> {
	return lines.map(line =>
		[...line].map(character => {
			const code = character.charCodeAt(0);
			return code === 32 ? null : (font[code] ?? font[63]);
		})
	);
}
