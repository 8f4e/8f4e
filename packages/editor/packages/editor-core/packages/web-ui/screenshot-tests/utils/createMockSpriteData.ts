import type { State } from '@8f4e/editor-state-types';
import generateSprite from '@8f4e/sprite-generator';
import type { SpriteData } from '@8f4e/web-ui';

/**
 * Generate sprite data for testing
 * @param state The state object to get font and color scheme from
 * @returns SpriteData for use in web-ui init
 */
export default async function createMockSpriteData(state: State): Promise<SpriteData> {
	return generateSprite({
		font: state.editorConfig.font,
		palette: state.editorConfig.color,
	});
}
