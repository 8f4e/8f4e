import type { State } from '@8f4e/editor-state-types';
import type { SpriteData, SpriteIdLookups } from '@8f4e/sprite-generator';

/**
 * Installs sprite ids resolved against the active renderer atlas and updates font grid metrics.
 *
 * Note: hGrid represents horizontal grid lines (vertical spacing = character height)
 *       vGrid represents vertical grid lines (horizontal spacing = character width)
 *
 * @param state - Editor state receiving the render-ready lookup tables.
 * @param spriteData - Generated sprite data containing character dimensions.
 * @param spriteLookups - Dense ids resolved from the atlas installed by the web UI.
 */
export function updateStateWithSpriteData(state: State, spriteData: SpriteData, spriteLookups: SpriteIdLookups): void {
	state.spriteLookups = spriteLookups;
	state.viewport.hGrid = spriteData.characterHeight;
	state.viewport.vGrid = spriteData.characterWidth;
}
