import type { SpriteFont, SpriteId, SpriteIdLookups } from '@8f4e/sprite-generator';

/**
 * Resolves a screenshot fixture line to the same render-ready cells produced by editor-state.
 *
 * @param line - Text fixture to resolve.
 * @param font - Validated font used for glyph lookup and fallback.
 * @returns Render-ready sprite ids and empty space cells.
 */
function resolveLine(line: string, font: SpriteFont): Array<SpriteId | null> {
	return [...line].map(character => {
		const characterCode = character.charCodeAt(0);
		return characterCode === 32 ? null : (font[characterCode] ?? font[63]);
	});
}

/**
 * Resolves fixture lines with a different generated font on each row.
 *
 * @param lines - Text fixture rows to resolve.
 * @param spriteLookups - Generated fonts assigned to successive fixture rows.
 * @returns Render-ready rows for screenshot state.
 */
export function resolveCodeWithAllColors(lines: string[], spriteLookups: SpriteIdLookups) {
	const fonts = [
		spriteLookups.fontPrimaryBase,
		spriteLookups.fontInkMuted,
		spriteLookups.fontInkBase,
		spriteLookups.fontInkMuted,
		spriteLookups.fontPrimaryBase,
		spriteLookups.fontSecondaryBase,
		spriteLookups.fontNegativeOn,
		spriteLookups.fontInkBase,
		spriteLookups.fontPrimaryBase,
		spriteLookups.fontPrimaryBase,
		spriteLookups.fontInkMuted,
		spriteLookups.fontInkBase,
		spriteLookups.fontPrimaryOn,
		spriteLookups.fontSecondaryBase,
		spriteLookups.fontDarkOverlaySoft,
		spriteLookups.fontPrimaryOverlay,
	];
	return lines.map((line, index) => resolveLine(line, fonts[index] ?? spriteLookups.fontInkBase));
}

/**
 * Resolves every fixture line with one generated font.
 *
 * @param lines - Text fixture rows to resolve.
 * @param font - Generated font applied to every row.
 * @returns Render-ready rows for screenshot state.
 */
export function resolveCodeWithOneColor(lines: string[], font: SpriteFont) {
	return lines.map(line => resolveLine(line, font));
}
