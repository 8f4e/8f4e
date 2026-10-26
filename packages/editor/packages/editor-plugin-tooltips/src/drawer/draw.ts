import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { SpriteFont } from '@8f4e/sprite-generator';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
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

function getMemoryForLiveValueLine(
	state: State,
	moduleId: string,
	memoryId: string
): PlannedMemoryDeclaration | undefined {
	return resolveMemoryTarget(state, { kind: 'module', moduleId }, memoryId)?.memory;
}

function getLiveValueText(state: State, memoryViews: MemoryViews, liveValue: TooltipLiveValue): string | undefined {
	const memory = getMemoryForLiveValueLine(state, liveValue.source.moduleId, liveValue.source.memoryId);

	if (!memory) {
		return undefined;
	}

	switch (liveValue.source.kind) {
		case 'memoryAddress':
			return String(memory.byteAddress);
		case 'memoryValue':
			return formatMemoryValue(
				memoryViews,
				memory.byteAddress + (liveValue.source.elementIndex ?? 0) * memory.elementWordSize,
				memory.allocationUnitAddress + (liveValue.source.elementIndex ?? 0),
				memory
			);
		case 'memoryDereference': {
			const pointerByteAddress = memoryViews.int32[memory.allocationUnitAddress];
			return formatMemoryValue(memoryViews, pointerByteAddress, pointerByteAddress / 4, liveValue.source.format);
		}
	}
}

function drawCharactersWithColors(
	engine: DrawContext,
	state: State,
	characters: Array<number | string>,
	colors: Array<SpriteFont | undefined> | undefined,
	x: number,
	y: number
): void {
	const spriteLookups = state.spriteLookups!;
	let currentLookup = colors?.[0] ?? spriteLookups.fontInverseInk;

	for (let index = 0; index < characters.length; index++) {
		const nextLookup = colors?.[index] ?? currentLookup;

		currentLookup = nextLookup;

		if (characters[index] !== 32) {
			engine.drawSprite(x + index * state.viewport.vGrid, y, currentLookup[characters[index]] ?? currentLookup[63]);
		}
	}
}

function drawTextCharacters(
	engine: DrawContext,
	state: State,
	text: string,
	x: number,
	y: number,
	font: SpriteFont
): void {
	for (let index = 0; index < text.length; index++) {
		const character = text.charCodeAt(index);

		if (character !== 32) {
			engine.drawSprite(x + index * state.viewport.vGrid, y, font[character] ?? font[63]);
		}
	}
}

function drawLiveValue(
	engine: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	liveValue: TooltipLiveValue,
	offset: TooltipAnimationOffset
): void {
	const spriteLookups = state.spriteLookups!;
	const value = getLiveValueText(state, memoryViews, liveValue);

	if (value === undefined) {
		return;
	}

	drawTextCharacters(
		engine,
		state,
		value,
		liveValue.x + offset.x,
		liveValue.y + offset.y,
		liveValue.color ?? spriteLookups.fontInverseAccent
	);
}

export default function drawTooltip(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews,
	tooltip: TooltipState
): void {
	const spriteLookups = state.spriteLookups;

	if (
		!spriteLookups ||
		!state.featureFlags.codeLineSelection ||
		state.codeBlockRendering.selectedCodeBlock !== codeBlock
	) {
		return;
	}

	if (tooltip.lineCount === 0) {
		return;
	}

	const { width, height, x, y, lineX } = tooltip.layout;
	const animationOffset = getTooltipAnimationOffset(tooltip, state.viewport.vGrid);

	engine.drawSprite(
		x + animationOffset.x,
		y + animationOffset.y,
		spriteLookups.fillColors.inverseSurface,
		width,
		height
	);

	for (const highlight of tooltip.highlights) {
		engine.drawSprite(
			highlight.x + animationOffset.x,
			highlight.y + animationOffset.y,
			spriteLookups.fillColors[highlight.fillColor],
			highlight.width,
			highlight.height
		);
	}

	for (let index = 0; index < tooltip.characters.length; index++) {
		drawCharactersWithColors(
			engine,
			state,
			tooltip.characters[index],
			tooltip.colors[index],
			lineX + animationOffset.x,
			y + index * state.viewport.hGrid + animationOffset.y
		);
	}

	for (const liveValue of tooltip.liveValues) {
		drawLiveValue(engine, state, memoryViews, liveValue, animationOffset);
	}
}
