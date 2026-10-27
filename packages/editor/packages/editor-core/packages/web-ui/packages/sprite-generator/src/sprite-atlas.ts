import type { SpriteAtlasImage, SpriteAtlasResolver, SpriteId, SpriteIdentifier, SpriteLookup } from 'glugglugglug';

/** Fixed-cell glyph IDs, shared by all palette colors. */
export type SpriteFont = Readonly<Partial<Record<number, SpriteId>>> & { readonly 63: SpriteId };

export interface SpriteIdentifierLookups {
	font: Readonly<Record<number, SpriteIdentifier>> & { readonly 63: SpriteIdentifier };
	fill: SpriteIdentifier;
}

export interface SpriteIdLookups {
	font: SpriteFont;
	fill: SpriteId;
}

export interface SpriteAtlas {
	image: SpriteAtlasImage;
	lookup: SpriteLookup;
	spriteIdentifiers: SpriteIdentifierLookups;
}

/** Resolve the generated shapes against the installed renderer atlas before drawing. */
export function resolveSpriteIds(identifiers: SpriteIdentifierLookups, resolver: SpriteAtlasResolver): SpriteIdLookups {
	return {
		font: Object.fromEntries(
			Object.entries(identifiers.font).map(([code, identifier]) => [code, resolver.resolveSprite(identifier)])
		) as SpriteFont,
		fill: resolver.resolveSprite(identifiers.fill),
	};
}
