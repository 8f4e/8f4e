import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, type vi } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../__tests__/rendering';
import { createEmptyTooltipState } from '../state/layout';
import type { TooltipState } from '../types';
import drawTooltip, { getTooltipAnimationOffset } from './draw';

describe('selected line tooltip animation', () => {
	it('follows a damped elliptical path from the left into its final position', () => {
		const state = createMockState();
		const tooltip: TooltipState = {
			...createEmptyTooltipState(),
			animation: {
				startedAt: 1_000,
			},
		};

		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_000)).toEqual({ x: -16, y: 0 });
		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_100)).toEqual({ x: 0, y: -6 });
		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_200)).toEqual({ x: 9, y: 0 });
		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_300)).toEqual({ x: 0, y: 3 });
		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_400)).toEqual({ x: -3, y: 0 });
		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_600)).toEqual({ x: 0, y: 0 });
		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_700)).toEqual({ x: 0, y: 0 });
	});

	it('draws in the final position when no animation is active', () => {
		const state = createMockState();
		const tooltip = createEmptyTooltipState();

		expect(getTooltipAnimationOffset(tooltip, state.viewport.vGrid, 1_000)).toEqual({ x: 0, y: 0 });
	});

	it('renders an invalid marker instead of dereferencing a negative pointer', () => {
		const codeBlock = createMockCodeBlock();
		const highlightFont = createSpriteIdLookupMock();
		const state = createMockState({
			compiler: {
				memoryPlan: {
					modules: {
						test: {
							memory: {
								pointer: {
									allocationUnitAddress: 0,
								},
							},
						},
					},
				},
			} as never,
			featureFlags: { codeLineSelection: true },
			codeBlockRendering: { selectedCodeBlock: codeBlock },
			spriteLookups: {
				fillColors: { inverseSurface: 'inverseSurface' },
				fontInverseAccent: highlightFont,
			} as never,
		});
		const tooltip: TooltipState = {
			...createEmptyTooltipState(),
			lineCount: 1,
			layout: { horizontalPadding: 0, width: 80, height: 16, x: 0, y: 0, lineX: 0 },
			highlights: [],
			characters: [],
			colors: [],
			liveValues: [
				{
					x: 8,
					y: 16,
					source: {
						kind: 'memoryDereference',
						moduleId: 'test',
						memoryId: 'pointer',
						format: { elementWordSize: 1, isInteger: true, isUnsigned: true },
					},
					color: highlightFont,
				},
			],
		};
		const buffer = new ArrayBuffer(4);
		const memoryViews: MemoryViews = {
			int8: new Int8Array(buffer),
			int16: new Int16Array(buffer),
			int32: new Int32Array(buffer),
			uint8: new Uint8Array(buffer),
			uint16: new Uint16Array(buffer),
			float32: new Float32Array(buffer),
			float64: new Float64Array(0),
		};
		memoryViews.int32[0] = -1;
		const engine = createDrawContextMock();

		drawTooltip(engine, state, codeBlock, memoryViews, tooltip);

		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			8,
			16,
			'?'.charCodeAt(0)
		);
	});
});

function createMemoryViews({ int32 = [] }: { int32?: number[] } = {}): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(int32),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
}

function createTooltipColors(
	line: string,
	defaultLookup: object,
	transitions: Array<[number, object]>
): Array<object | undefined> {
	const colors: Array<object | undefined> = new Array(line.length).fill(undefined);
	colors[0] = defaultLookup;

	transitions.forEach(([index, lookup]) => {
		colors[index] = lookup;
	});

	return colors;
}

function createCharacters(text: string): number[] {
	return [...text].map(char => char.charCodeAt(0));
}

function createTooltipCharacters(lines: string[]): number[][] {
	return lines.map(createCharacters);
}

function createMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 'value',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int' as const,
		byteAddress: 0,
		elementByteLength: 4,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		allocationUnitAddress: 0,
		endByteAddress: 0,
		endAddressSafeByteLength: 4,
		lineNumber: 1,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
}

describe('tooltip drawing', () => {
	it('draws tooltip text next to the selected line', () => {
		const fillColors = createSpriteIdLookupMock();
		const fontInkBase = createSpriteIdLookupMock();
		const fontInverseAccent = createSpriteIdLookupMock();
		const fontInverseInk = createSpriteIdLookupMock();
		const block = createMockCodeBlock({
			width: 100,
			height: 80,
			cursor: {
				row: 1,
				col: 0,
				x: 16,
				y: 16,
			},
		});
		const state = createMockState({
			spriteLookups: {
				fillColors,
				fontInkBase,
				fontSecondaryBase: createSpriteIdLookupMock(),
				fontInkFaint: createSpriteIdLookupMock(),
				fontMutedBase: createSpriteIdLookupMock(),
				fontInverseAccent,
				fontInverseInk,
			} as never,
			codeBlockRendering: {
				codeBlocks: [block],
				selectedCodeBlock: block,
			},
			featureFlags: {
				codeLineSelection: true,
			},
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
		});
		const tooltip: TooltipState = {
			...createEmptyTooltipState(),
			text: ['add (T T -- T)', 'Adds two numbers', 'before [int=1, int=2]', 'after: [int=3]'],
			characters: createTooltipCharacters([
				'add (T T -- T)',
				'Adds two numbers',
				'before [int=1, int=2]',
				'after: [int=3]',
			]),
			colors: [
				createTooltipColors('add (T T -- T)', fontInverseInk, [[0, fontInverseAccent]]),
				createTooltipColors('Adds two numbers', fontInverseInk, []),
				createTooltipColors('before [int=1, int=2]', fontInverseInk, [[7, fontInverseAccent]]),
				createTooltipColors('after: [int=3]', fontInverseInk, [[7, fontInverseAccent]]),
			] as never,
			lineCount: 4,
			widthChars: 'before [int=1, int=2]'.length,
			layout: {
				horizontalPadding: 8,
				width: 184,
				height: 64,
				x: -192,
				y: 16,
				lineX: -184,
			},
			highlights: [
				{
					x: -120,
					y: 48,
					width: 48,
					height: 16,
					fillColor: 'negativeSoft',
				},
			],
		};
		const engine = createDrawContextMock();

		drawTooltip(engine, state, block, createMemoryViews(), tooltip);

		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-192,
			16,
			'inverseSurface',
			184,
			64
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-120,
			48,
			'negativeSoft',
			48,
			16
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-184,
			16,
			'a'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-184,
			32,
			'A'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-184,
			48,
			'b'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-128,
			48,
			'['.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-184,
			64,
			'a'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-128,
			64,
			'['.charCodeAt(0)
		);
	});

	it('draws live memory declaration values from tooltip metadata', () => {
		const block = createMockCodeBlock({
			width: 100,
			height: 80,
			name: 'test',
			cursor: {
				row: 0,
				col: 0,
				x: 16,
				y: 16,
			},
			code: ['add'],
		});
		const pointer = createMemory({
			id: 'pointer',
			type: 'int*' as const,
			byteAddress: 8,
			allocationUnitAddress: 2,
			endByteAddress: 8,
			pointeeBaseType: 'int',
		});
		const state = createMockState({
			compiler: {
				memoryPlan: {
					modules: {
						test: {
							id: 'test',
							lineNumber: 1,
							byteAddress: 8,
							allocationUnitCount: 1,
							allocatedByteLength: 4,
							endByteAddress: 8,
							endAddressSafeByteLength: 4,
							memory: {
								pointer,
							},
							declarations: [pointer],
							declarationSources: [],
						},
					},
					moduleList: [],
				},
			},
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontSecondaryBase: createSpriteIdLookupMock(),
				fontInkBase: createSpriteIdLookupMock(),
				fontInkFaint: createSpriteIdLookupMock(),
				fontMutedBase: createSpriteIdLookupMock(),
				fontInverseAccent: createSpriteIdLookupMock(),
				fontInverseInk: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: {
				codeBlocks: [block],
				selectedCodeBlock: block,
			},
			featureFlags: {
				codeLineSelection: true,
			},
		});
		const tooltip: TooltipState = {
			...createEmptyTooltipState(),
			text: ['int ( -- )', 'address: ', 'value: ', 'deref: '],
			characters: createTooltipCharacters(['int ( -- )', 'address: ', 'value: ', 'deref: ']),
			colors: [[], [], [], []],
			lineCount: 4,
			widthChars: 19,
			layout: {
				horizontalPadding: 8,
				width: 168,
				height: 64,
				x: -176,
				y: 16,
				lineX: -168,
			},
			liveValues: [
				{
					x: -168 + 'address: '.length * 8,
					y: 16 + 16,
					source: { kind: 'memoryAddress', moduleId: 'test', memoryId: 'pointer' },
					color: createSpriteIdLookupMock(),
				},
				{
					x: -168 + 'value: '.length * 8,
					y: 16 + 2 * 16,
					source: { kind: 'memoryValue', moduleId: 'test', memoryId: 'pointer', elementIndex: 0 },
					color: createSpriteIdLookupMock(),
				},
				{
					x: -168 + 'deref: '.length * 8,
					y: 16 + 3 * 16,
					source: {
						kind: 'memoryDereference',
						moduleId: 'test',
						memoryId: 'pointer',
						format: {
							elementWordSize: 4,
							isInteger: true,
							isUnsigned: false,
						},
					},
					color: createSpriteIdLookupMock(),
				},
			],
		};
		const engine = createDrawContextMock();

		drawTooltip(engine, state, block, createMemoryViews({ int32: [0, 0, 20, 0, 0, 123] }), tooltip);

		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'a'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'v'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'2'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'd'.charCodeAt(0)
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'1'.charCodeAt(0)
		);
	});
});
