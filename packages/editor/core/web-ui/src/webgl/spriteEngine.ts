import type { Engine } from 'glugglugglug';

/** The sprite and render-hook API used by web-ui. Alternative engines can satisfy it structurally. */
export type SpriteEngine = Pick<
	Engine,
	| 'gl'
	| 'hooks'
	| 'frameStats'
	| 'setPalette'
	| 'setSpriteAtlas'
	| 'drawSprite'
	| 'resize'
	| 'renderFrame'
	| 'releaseRenderingMemory'
	| 'restoreRenderingMemory'
	| 'destroy'
>;
