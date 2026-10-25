import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { WebUiRenderData } from '@8f4e/web-ui-render-projection';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpriteIdLookupMock } from '../../__tests__/rendering';
import type { DrawContext as Engine } from '../../drawContext';
import type { MemoryViews } from '../../types';
import { createCodeBlockDrawerRegistry } from '../registry';
import drawModules from './index';

const emptyRenderData: WebUiRenderData = { codeBlocks: new Map() };

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

function createMockEngine(): Engine {
	return {
		startGroup: vi.fn(),
		endGroup: vi.fn(),
		drawSprite: vi.fn(),
		drawText: vi.fn(),
		drawResolvedText: vi.fn(),
	} as unknown as Engine;
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

describe('drawModules', () => {
	it('runs plugin drawers inside each visible block group in registration order', () => {
		const visible = createMockCodeBlock({ width: 96, height: 64, x: 16, y: 16 });
		const offscreen = createMockCodeBlock({ creationIndex: 1, x: 10000 });
		const state = createMockState({
			spriteLookups: { fillColors: createSpriteIdLookupMock(), fontCode: createSpriteIdLookupMock() } as never,
			codeBlockRendering: { codeBlocks: [visible, offscreen] },
		});
		const engine = createMockEngine();
		const memoryViews = createMemoryViews();
		const drawers = createCodeBlockDrawerRegistry();
		const calls: string[] = [];
		const first = vi.fn(context => {
			expect(context).toEqual({ draw: engine, state, codeBlock: visible, memoryViews });
			expect(engine.startGroup).toHaveBeenLastCalledWith(visible.x, visible.y);
			calls.push('first');
		});
		const unregister = drawers.registerCodeBlockDrawer(first);
		drawers.registerCodeBlockDrawer(() => calls.push('second'));
		drawModules(engine, state, memoryViews, emptyRenderData, drawers);
		expect(calls).toEqual(['first', 'second']);
		unregister();
		drawModules(engine, state, memoryViews, emptyRenderData, drawers);
		expect(calls).toEqual(['first', 'second', 'second']);
		expect(first).toHaveBeenCalledOnce();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each(['view', 'edit'] as const)('draws an animated outline only for the selected block in %s mode', editorMode => {
		const selectedBlock = createMockCodeBlock({ creationIndex: 0, width: 96, height: 64 });
		const otherBlock = createMockCodeBlock({ creationIndex: 1, x: 160, width: 96, height: 64 });
		const state = createMockState({
			editorMode,
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontNumbers: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: {
				codeBlocks: [selectedBlock, otherBlock],
				selectedCodeBlock: selectedBlock,
			},
		});
		const engine = createMockEngine();
		const now = vi.spyOn(performance, 'now').mockReturnValue(0);
		const outlineCalls = () => vi.mocked(engine.drawText).mock.calls.filter(call => call[2] !== '+' && call[2] !== '_');

		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		const initialOutline = outlineCalls();
		expect(initialOutline).toHaveLength(4);

		vi.mocked(engine.drawText).mockClear();
		now.mockReturnValue(80);
		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		expect(outlineCalls()).toHaveLength(4);
		expect(outlineCalls()).not.toEqual(initialOutline);

		vi.mocked(engine.drawText).mockClear();
		state.codeBlockRendering.selectedCodeBlock = otherBlock;
		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		expect(outlineCalls()).toHaveLength(4);

		vi.mocked(engine.drawText).mockClear();
		state.codeBlockRendering.selectedCodeBlock = undefined;
		drawModules(engine, state, createMemoryViews(), emptyRenderData);
		expect(outlineCalls()).toHaveLength(0);
	});

	it('draws assertion rectangles over the rendered line numbers', () => {
		const block = createMockCodeBlock({ creationIndex: 4, width: 100, height: 64 });
		block.widgets.assertions = [{ lineNumber: 2, passed: true, x: 8, y: 32, width: 8, height: 16 }];
		const state = createMockState({
			spriteLookups: { fillColors: createSpriteIdLookupMock(), fontCode: createSpriteIdLookupMock() } as never,
			codeBlockRendering: { codeBlocks: [block] },
		});
		const engine = createMockEngine();
		const renderData: WebUiRenderData = { codeBlocks: new Map([[4, { codeCells: [[1], [2], [3]] as never }]]) };
		drawModules(engine, state, createMemoryViews(), renderData);
		const sprites = vi.mocked(engine.drawSprite);
		const markerSprite = state.spriteLookups!.fillColors.assertionPassed;
		const markerIndex = sprites.mock.calls.findIndex(call => call[2] === markerSprite);
		expect(sprites).toHaveBeenCalledWith(8, 32, 'assertionPassed', 8, 16);
		expect(sprites.mock.invocationCallOrder[markerIndex]).toBeGreaterThan(
			vi.mocked(engine.drawResolvedText).mock.invocationCallOrder.at(-1)!
		);
	});
	it('draws resolved code cells from projected render data', () => {
		const block = createMockCodeBlock({ creationIndex: 4, width: 100, height: 50 });
		const state = createMockState({
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontNumbers: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: { codeBlocks: [block] },
		});
		const engine = createMockEngine();
		const codeCells = [[1, null, 2]] as never;

		drawModules(engine, state, createMemoryViews(), {
			codeBlocks: new Map([[block.creationIndex, { codeCells }]]),
		});

		expect((engine as unknown as { drawResolvedText: ReturnType<typeof vi.fn> }).drawResolvedText).toHaveBeenCalledWith(
			state.viewport.vGrid,
			0,
			codeCells[0]
		);
	});

	it('draws precomputed entry outlines before rendering code blocks', () => {
		const state = createMockState({
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontEntryName: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: {
				codeBlocks: [],
				entryOutlines: [
					{
						entryName: 'main',
						topLeft: { x: 8, y: 16 },
						topRight: { x: 104, y: 16 },
						bottomRight: { x: 104, y: 96 },
						bottomLeft: { x: 8, y: 96 },
					},
				],
			},
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
		});
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews(), emptyRenderData);

		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenNthCalledWith(
			1,
			8,
			16,
			'wire',
			96,
			1
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenNthCalledWith(
			2,
			8,
			95,
			'wire',
			96,
			1
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenNthCalledWith(
			3,
			8,
			16,
			'wire',
			1,
			80
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenNthCalledWith(
			4,
			103,
			16,
			'wire',
			1,
			80
		);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			16,
			16,
			'main',
			state.spriteLookups?.fontEntryName
		);
	});

	it('draws piano keyboards after the static block contents', () => {
		const block = createMockCodeBlock({
			width: 100,
			height: 80,
		});
		block.widgets.pianoKeyboards = [
			{
				pressedKeysListModuleId: 'test-block',
				pressedNumberOfKeysModuleId: 'test-block',
				x: 0,
				y: 16,
				width: 48,
				height: 20,
				keyWidth: 2,
				keyY: 16,
				keyHeight: 4,
				blackKeyHeight: 2,
				blackKeySideY: 18,
				blackKeySideHeight: 2,
				blackKeyGapXOffset: 0.75,
				blackKeyGapY: 18,
				blackKeyGapWidth: 0.5,
				blackKeyGapHeight: 2,
				lineNumber: 0,
				keys: [
					{
						offset: 0,
						x: 0,
						label: 'C',
						labelX: 0,
						labelY: 0,
						kind: 'white',
						sprite: 'pianoKeyWhite',
						pressedOverlayX: 0,
						pressedOverlayRows: [16],
						pressedOverlayFont: 'fontPianoKeyWhitePressedOverlay',
					},
				],
				pressedKeysListMemory: {
					id: 'notes',
					allocationUnitAddress: 0,
					allocationUnitCount: 12,
					isInteger: true,
				},
				pressedNumberOfKeysMemory: {
					id: 'noteCount',
					allocationUnitAddress: 12,
					allocationUnitCount: 1,
					isInteger: true,
				},
				startingNumber: 48,
			},
		] as never;
		const state = createMockState({
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontNumbers: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontPianoKeyWhitePressedOverlay: createSpriteIdLookupMock(),
				fontDisabledCode: createSpriteIdLookupMock(),
				fontLineNumber: createSpriteIdLookupMock(),
				fontCodeComment: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: {
				codeBlocks: [block],
			},
		});
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews({ int32: [48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }), emptyRenderData);

		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			0,
			16,
			'pianoKeyWhite',
			2,
			4
		);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			0,
			16,
			';;',
			state.spriteLookups?.fontPianoKeyWhitePressedOverlay
		);
	});

	it('draws tooltip text next to the selected line', () => {
		const fillColors = createSpriteIdLookupMock();
		const fontCode = createSpriteIdLookupMock();
		const fontTooltipHighlight = createSpriteIdLookupMock();
		const fontTooltipText = createSpriteIdLookupMock();
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
				fontCode,
				fontNumbers: createSpriteIdLookupMock(),
				fontDisabledCode: createSpriteIdLookupMock(),
				fontLineNumber: createSpriteIdLookupMock(),
				fontCodeComment: createSpriteIdLookupMock(),
				fontTooltipHighlight,
				fontTooltipText,
			} as never,
			codeBlockRendering: {
				codeBlocks: [block],
				selectedCodeBlock: block,
			},
			featureFlags: {
				codeLineSelection: true,
			},
			tooltip: {
				text: ['add (T T -- T)', 'Adds two numbers', 'before [int=1, int=2]', 'after: [int=3]'],
				characters: createTooltipCharacters([
					'add (T T -- T)',
					'Adds two numbers',
					'before [int=1, int=2]',
					'after: [int=3]',
				]),
				colors: [
					createTooltipColors('add (T T -- T)', fontTooltipText, [[0, fontTooltipHighlight]]),
					createTooltipColors('Adds two numbers', fontTooltipText, []),
					createTooltipColors('before [int=1, int=2]', fontTooltipText, [[7, fontTooltipHighlight]]),
					createTooltipColors('after: [int=3]', fontTooltipText, [[7, fontTooltipHighlight]]),
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
						fillColor: 'tooltipConsumedHighlight',
					},
				],
			},
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
		});
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews(), emptyRenderData);

		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-192,
			16,
			'tooltipBackground',
			184,
			64
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).toHaveBeenCalledWith(
			-120,
			48,
			'tooltipConsumedHighlight',
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
				fontNumbers: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontDisabledCode: createSpriteIdLookupMock(),
				fontLineNumber: createSpriteIdLookupMock(),
				fontCodeComment: createSpriteIdLookupMock(),
				fontTooltipHighlight: createSpriteIdLookupMock(),
				fontTooltipText: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: {
				codeBlocks: [block],
				selectedCodeBlock: block,
			},
			featureFlags: {
				codeLineSelection: true,
			},
			tooltip: {
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
			},
		});
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews({ int32: [0, 0, 20, 0, 0, 123] }), emptyRenderData);

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

	it('can skip off-screen arrow indicators', () => {
		const offscreenBlock = createMockCodeBlock({
			x: 1200,
			y: 384,
			width: 100,
			height: 80,
		});
		const state = createMockState({
			spriteLookups: {
				fontArrow: createSpriteIdLookupMock(),
			} as never,
			codeBlockRendering: {
				codeBlocks: [offscreenBlock],
			},
			viewport: {
				width: 1024,
				height: 768,
				vGrid: 8,
				hGrid: 16,
				center: { x: 512, y: 384 },
				borderLineCoordinates: {
					top: { startX: 0, startY: 0, endX: 1024, endY: 0 },
					right: { startX: 1024, startY: 0, endX: 1024, endY: 768 },
					bottom: { startX: 0, startY: 768, endX: 1024, endY: 768 },
					left: { startX: 0, startY: 0, endX: 0, endY: 768 },
				},
			},
			featureFlags: {
				offscreenBlockArrows: false,
			},
		});
		const engine = createMockEngine();

		drawModules(engine, state, createMemoryViews(), emptyRenderData);

		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).not.toHaveBeenCalled();
	});
});
