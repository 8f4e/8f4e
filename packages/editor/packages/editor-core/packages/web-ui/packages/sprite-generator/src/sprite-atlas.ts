import type {
	SpriteAtlasImage,
	SpriteAtlasResolver,
	SpriteCoordinates,
	SpriteId,
	SpriteIdentifier,
	SpriteLookup,
} from 'glugglugglug';

type SpriteLookupGroup = Record<string | number, SpriteCoordinates>;

/** One sparse semantic sprite group containing public atlas identifiers. */
export type SpriteIdentifierLookup = Partial<Record<string | number, SpriteIdentifier>>;

/** One sparse semantic sprite group resolved to validated dense atlas identifiers. */
export type SpriteIdLookup = Partial<Record<string | number, SpriteId>>;

export type SpriteIdentifiers<Lookups> = {
	[Group in keyof Lookups]: {
		[Sprite in keyof Lookups[Group]]: undefined extends Lookups[Group][Sprite]
			? SpriteIdentifier | undefined
			: SpriteIdentifier;
	};
};

export type ResolvedSpriteIds<Identifiers> = {
	[Group in keyof Identifiers]: {
		[Sprite in keyof Identifiers[Group]]: undefined extends Identifiers[Group][Sprite]
			? SpriteId | undefined
			: SpriteId;
	};
};

export type SpriteIds<Lookups> = ResolvedSpriteIds<SpriteIdentifiers<Lookups>>;

export type SpriteAtlas<Identifiers> = {
	image: SpriteAtlasImage;
	lookup: SpriteLookup;
	spriteIdentifiers: Identifiers;
};

/**
 * Converts grouped semantic sprite lookups into a flat numeric atlas lookup.
 *
 * Identical source rectangles share one public numeric key, while `spriteIdentifiers` retains the original lookup
 * groups and keys. Callers resolve these keys through the atlas resolver returned by `Engine.setSpriteAtlas()` before
 * entering the render loop.
 *
 * @param image - Generated atlas image accepted by `Engine.setSpriteAtlas()`.
 * @param groupedLookups - Existing sprite-generator lookup groups keyed by semantic role and local sprite identifier.
 * @returns An atlas image, flat lookup, and grouped public identifiers.
 */
export function createSpriteAtlas<Lookups extends object>(
	image: SpriteAtlasImage,
	groupedLookups: Lookups
): SpriteAtlas<SpriteIdentifiers<Lookups>> {
	const lookup: SpriteLookup = {};
	const spriteIdentifiers: Record<string, Record<string, SpriteIdentifier>> = {};
	const identifiersByRectangle = new Map<string, number>();

	for (const [groupName, groupLookup] of Object.entries(groupedLookups as Record<string, SpriteLookupGroup>)) {
		const groupIdentifiers: Record<string, SpriteIdentifier> = {};

		for (const [spriteIdentifier, coordinates] of Object.entries(groupLookup)) {
			assertValidCoordinates(image, groupName, spriteIdentifier, coordinates);
			const rectangleKey = JSON.stringify([
				coordinates.x,
				coordinates.y,
				coordinates.spriteWidth,
				coordinates.spriteHeight,
			]);
			let identifier = identifiersByRectangle.get(rectangleKey);

			if (identifier === undefined) {
				identifier = identifiersByRectangle.size;
				identifiersByRectangle.set(rectangleKey, identifier);
				lookup[identifier] = { ...coordinates };
			}

			groupIdentifiers[spriteIdentifier] = identifier;
		}

		spriteIdentifiers[groupName] = groupIdentifiers;
	}

	return {
		image,
		lookup,
		spriteIdentifiers: spriteIdentifiers as SpriteIdentifiers<Lookups>,
	};
}

/**
 * Resolves grouped public atlas identifiers against one installed atlas.
 *
 * @param spriteIdentifiers - Semantic lookup groups emitted with the atlas image and rectangle lookup.
 * @param resolver - Resolver returned when that exact atlas is installed on the engine.
 * @returns Matching semantic groups containing dense ids for hot-path drawing.
 */
export function resolveSpriteIds<Identifiers extends object>(
	spriteIdentifiers: Identifiers,
	resolver: SpriteAtlasResolver
): ResolvedSpriteIds<Identifiers> {
	const spriteIds: Record<string, Record<string, SpriteId>> = {};

	for (const [groupName, groupIdentifiers] of Object.entries(
		spriteIdentifiers as Record<string, Record<string, SpriteIdentifier | undefined>>
	)) {
		const groupIds: Record<string, SpriteId> = {};
		for (const [semanticKey, identifier] of Object.entries(groupIdentifiers)) {
			if (identifier !== undefined) {
				groupIds[semanticKey] = resolver.resolveSprite(identifier);
			}
		}
		spriteIds[groupName] = groupIds;
	}

	return spriteIds as ResolvedSpriteIds<Identifiers>;
}

/**
 * Validates a source rectangle before assigning its public atlas identifier.
 *
 * @param image - Atlas image that must fully contain the rectangle.
 * @param groupName - Semantic lookup group used in validation errors.
 * @param spriteIdentifier - Semantic sprite key used in validation errors.
 * @param coordinates - Rectangle to validate against the atlas and packed lookup format.
 */
function assertValidCoordinates(
	image: SpriteAtlasImage,
	groupName: string,
	spriteIdentifier: string,
	coordinates: SpriteCoordinates
): void {
	const values = [coordinates.x, coordinates.y, coordinates.spriteWidth, coordinates.spriteHeight];
	if (values.some(value => !Number.isInteger(value) || value < 0 || value > 0xffff)) {
		throw new RangeError(`Sprite ${groupName}.${spriteIdentifier} contains coordinates outside the uint16 range.`);
	}
	if (coordinates.spriteWidth === 0 || coordinates.spriteHeight === 0) {
		throw new RangeError(`Sprite ${groupName}.${spriteIdentifier} must have positive dimensions.`);
	}
	if (
		coordinates.x + coordinates.spriteWidth > image.width ||
		coordinates.y + coordinates.spriteHeight > image.height
	) {
		throw new RangeError(`Sprite ${groupName}.${spriteIdentifier} extends outside the atlas image.`);
	}
}
