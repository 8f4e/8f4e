export { type GlyphIds, textToGlyphIds } from '@8f4e/sprite-generator';
export { getAppearanceFont, registerWebUiConfig } from './font-and-palette/config';
export type { FontChangedEvent } from './font-and-palette/fontAtlas';
export type {
	CodeBlockOffsetResolver,
	CodeBlockPositionEffect,
	FrameBlockPosition,
	FrameBlockPositions,
} from './frame/blockPositions';
export type { FrameContext } from './frame/frameContext';
export type { RenderStats } from './frame/frameStats';
export {
	type CanvasDrawer,
	type CanvasDrawerContext,
	type CodeBlockDrawer,
	type CodeBlockDrawerContext,
	createEditorRenderRegistry,
	type EditorRenderHost,
	type EditorRenderRegistry,
	type OffscreenCodeBlockDrawer,
} from './frame/renderRegistry';
export { default, type WebUiOptions } from './initializeWebUi';
export type { MemoryViews } from './memoryViews';
export { DrawContext, type SpriteTarget } from './sprites/drawContext';
export { createSpriteCell, type SpriteCell } from './sprites/spriteCell';
export type {
	EditorRenderLayer,
	RenderLayerContext,
	RenderLayerFactory,
	RenderLayerStage,
} from './webgl/renderLayerRegistry';
export { createProgram, prepareRenderPass, requireResource, requireUniform } from './webgl/shaderUtils';
export type { SpriteEngine } from './webgl/spriteEngine';
