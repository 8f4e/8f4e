import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext, GlyphIds, MemoryViews } from '@8f4e/web-ui';
import type { TooltipLiveValue, TooltipState } from '../types';
import { formatMemoryValue } from './memoryValue';

const TOOLTIP_SPRING_DURATION_MS = 600;
const TOOLTIP_SPRING_REVOLUTIONS = 1.5;
const TOOLTIP_SPRING_VERTICAL_SCALE = 0.5;
const tooltipAnimationOffsetChars = 2;

export interface TooltipAnimationOffset {
	x: number;
	y: number;
}

export function getTooltipAnimationOffset(
	tooltip: TooltipState,
	vGrid: number,
	now = performance.now()
): TooltipAnimationOffset {
	const { startedAt } = tooltip.animation;

	if (startedAt === undefined) {
		return { x: 0, y: 0 };
	}

	const progress = Math.min(Math.max((now - startedAt) / TOOLTIP_SPRING_DURATION_MS, 0), 1);
	if (progress === 1) {
		return { x: 0, y: 0 };
	}

	const damping = (1 - progress) ** 1.5;
	const angle = progress * TOOLTIP_SPRING_REVOLUTIONS * Math.PI * 2;
	const horizontalRadius = tooltipAnimationOffsetChars * vGrid;
	const verticalRadius = horizontalRadius * TOOLTIP_SPRING_VERTICAL_SCALE;
	const x = Math.round(-horizontalRadius * damping * Math.cos(angle));
	const y = Math.round(-verticalRadius * damping * Math.sin(angle));

	return {
		x: x === 0 ? 0 : x,
		y: y === 0 ? 0 : y,
	};
}

function getLiveValueText(memoryViews: MemoryViews, liveValue: TooltipLiveValue): string {
	const { source } = liveValue;
	switch (source.kind) {
		case 'staticText':
			return source.text;
		case 'numericRead':
			return formatMemoryValue(memoryViews, source.read);
	}
}

function drawSpritesWithColors(
	engine: DrawContext,
	state: State,
	characters: GlyphIds,
	colors: Array<PaletteIndex | undefined> | undefined,
	x: number,
	y: number
): void {
	let currentColor = colors?.[0] ?? PALETTE_INDICES.inverseInk;

	for (let index = 0; index < characters.length; index++) {
		const nextColor = colors?.[index] ?? currentColor;

		currentColor = nextColor;

		if (characters[index] !== 32) {
			engine.drawSprite(x + index * state.viewport.vGrid, y, characters[index], currentColor);
		}
	}
}

function drawLiveValue(
	engine: DrawContext,
	memoryViews: MemoryViews,
	liveValue: TooltipLiveValue,
	offset: TooltipAnimationOffset
): void {
	const value = getLiveValueText(memoryViews, liveValue);

	engine.drawNumericText(
		liveValue.x + offset.x,
		liveValue.y + offset.y,
		value,
		liveValue.color ?? PALETTE_INDICES.inverseAccent
	);
}

export default function drawTooltip(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews,
	tooltip: TooltipState
): void {
	if (!state.featureFlags.codeLineSelection || state.codeBlockRendering.selectedCodeBlock !== codeBlock) {
		return;
	}

	if (tooltip.lineCount === 0) {
		return;
	}

	const { width, height, x, y, lineX } = tooltip.layout;
	const animationOffset = getTooltipAnimationOffset(tooltip, state.viewport.vGrid);

	engine.drawFill(x + animationOffset.x, y + animationOffset.y, PALETTE_INDICES.inverseSurface, width, height);

	for (const highlight of tooltip.highlights) {
		engine.drawFill(
			highlight.x + animationOffset.x,
			highlight.y + animationOffset.y,
			PALETTE_INDICES[highlight.fillColor],
			highlight.width,
			highlight.height
		);
	}

	for (let index = 0; index < tooltip.characters.length; index++) {
		drawSpritesWithColors(
			engine,
			state,
			tooltip.characters[index],
			tooltip.colors[index],
			lineX + animationOffset.x,
			y + index * state.viewport.hGrid + animationOffset.y
		);
	}

	for (const liveValue of tooltip.liveValues) {
		drawLiveValue(engine, memoryViews, liveValue, animationOffset);
	}
}
