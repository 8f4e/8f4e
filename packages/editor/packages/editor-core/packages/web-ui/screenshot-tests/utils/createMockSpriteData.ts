import type { State } from '@8f4e/editor-state-types';
import type { SpriteData } from '@8f4e/sprite-generator';
import generateSprite from '@8f4e/sprite-generator';

/**
 * Generate sprite data for testing
 * @param state The state object to get font from
 * @returns SpriteData for use in web-ui init
 */
export default async function createMockSpriteData(state: State): Promise<SpriteData> {
	return generateSprite({ font: state.editorConfig.font });
}
