import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, type vi } from 'vitest';
import { createDrawContextMock } from '../../../__tests__/rendering';
import type { MemoryViews } from '../../../types';
import drawDebuggers from './debuggers';

function createMemoryViews(): MemoryViews {
	return {
		int8: new Int8Array(4),
		int16: new Int16Array(2),
		int32: new Int32Array(1),
		uint8: new Uint8Array(4),
		uint16: new Uint16Array(2),
		float32: new Float32Array(1),
		float64: new Float64Array(0),
	};
}

describe('drawDebuggers', () => {
	it('adds one pair of brackets around compiler stack text', () => {
		const engine = createDrawContextMock();
		const state = createMockState({
			viewport: { vGrid: 8, hGrid: 16 },
			spriteLookups: createMockSpriteLookups() as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				debuggers: [
					{
						x: 5,
						y: 7,
						text: '2, 3',
					},
				],
			} as never,
		});

		drawDebuggers(engine, state, codeBlock, createMemoryViews(), 0);

		const drawCharacter = (engine as unknown as { drawCharacter: ReturnType<typeof vi.fn> }).drawCharacter;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		expect(drawCharacter).toHaveBeenNthCalledWith(1, 5, 7, 91, PALETTE_INDICES.inkBase, 8, 16);
		expect(drawText).toHaveBeenCalledOnce();
		expect(drawText).toHaveBeenCalledWith(13, 7, '2, 3', PALETTE_INDICES.secondaryBase);
		expect(drawCharacter).toHaveBeenNthCalledWith(2, 45, 7, 93, PALETTE_INDICES.inkBase, 8, 16);
	});

	it('moves the brackets linearly outward around a stationary live value', () => {
		const engine = createDrawContextMock();
		const state = createMockState({
			viewport: { vGrid: 8, hGrid: 16 },
			spriteLookups: createMockSpriteLookups() as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				debuggers: [
					{
						x: 5,
						y: 7,
						text: '2, 3',
					},
				],
			} as never,
		});

		drawDebuggers(engine, state, codeBlock, createMemoryViews(), 275);

		const drawCharacter = (engine as unknown as { drawCharacter: ReturnType<typeof vi.fn> }).drawCharacter;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		const [leftX, bracketY, leftSprite, _leftColor, bracketWidth, bracketHeight] = drawCharacter.mock.calls[0];
		const [rightX, rightY, rightSprite, _rightColor, rightWidth, rightHeight] = drawCharacter.mock.calls[1];
		expect(leftX).toBeCloseTo(4.17);
		expect(bracketY).toBeCloseTo(6.84);
		expect(leftSprite).toBe(91);
		expect(bracketWidth).toBeCloseTo(8.16);
		expect(bracketHeight).toBeCloseTo(16.32);
		expect(drawText).toHaveBeenCalledWith(13, 7, '2, 3', PALETTE_INDICES.secondaryBase);
		expect(rightX).toBeCloseTo(45.67);
		expect(rightY).toBeCloseTo(6.84);
		expect(rightSprite).toBe(93);
		expect(rightWidth).toBeCloseTo(8.16);
		expect(rightHeight).toBeCloseTo(16.32);
	});

	it('renders an invalid marker when a watch points outside memory', () => {
		const engine = createDrawContextMock();
		const state = createMockState({
			viewport: { vGrid: 8, hGrid: 16 },
			spriteLookups: createMockSpriteLookups() as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				debuggers: [
					{
						x: 5,
						y: 7,
						memory: {
							byteAddress: 0,
							allocationUnitAddress: 0,
							elementWordSize: 4,
							isInteger: true,
							isUnsigned: false,
						},
						bufferPointer: 1,
						displayFormat: 'decimal',
						showAddress: false,
						showEndAddress: false,
					},
				],
			} as never,
		});

		drawDebuggers(engine, state, codeBlock, createMemoryViews(), 1100, true);

		const drawCharacter = (engine as unknown as { drawCharacter: ReturnType<typeof vi.fn> }).drawCharacter;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		expect(drawCharacter).toHaveBeenNthCalledWith(1, 5, 7, 91, PALETTE_INDICES.inkBase, 8, 16);
		expect(drawText).toHaveBeenCalledOnce();
		expect(drawText).toHaveBeenCalledWith(13, 7, '?', PALETTE_INDICES.secondaryBase);
		expect(drawCharacter).toHaveBeenNthCalledWith(2, 21, 7, 93, PALETTE_INDICES.inkBase, 8, 16);
	});

	describe('address watches', () => {
		function renderAddress(memory: Record<string, unknown>, bufferPointer: number, showEndAddress = false): string {
			const engine = createDrawContextMock();
			const state = createMockState({
				viewport: { vGrid: 8, hGrid: 16 },
				spriteLookups: createMockSpriteLookups() as never,
			});
			const codeBlock = createMockCodeBlock({
				widgets: {
					debuggers: [
						{
							x: 5,
							y: 7,
							memory,
							bufferPointer,
							displayFormat: 'decimal',
							showAddress: !showEndAddress,
							showEndAddress,
						},
					],
				} as never,
			});

			drawDebuggers(engine, state, codeBlock, createMemoryViews(), 0, true);

			const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
			expect(drawText).toHaveBeenCalledOnce();
			return drawText.mock.calls[0][2];
		}

		it('keeps ordinary 32-bit indexed addresses unchanged', () => {
			const memory = { byteAddress: 16, elementWordSize: 4, allocationUnitCount: 4, endByteAddress: 28 };

			expect(renderAddress(memory, 0)).toBe('16');
			expect(renderAddress(memory, 3)).toBe('28');
			expect(renderAddress(memory, 0, true)).toBe('28');
		});

		it.each([
			['int8[]', 1, '23'],
			['int16[]', 2, '30'],
			['float64[]', 8, '72'],
		])('steps indexed %s addresses by the element width', (_type, elementWordSize, expected) => {
			const memory = { byteAddress: 16, elementWordSize, allocationUnitCount: 16, endByteAddress: 76 };

			expect(renderAddress(memory, 7)).toBe(expected);
		});

		it('uses the planned end address for a float64 declaration with leading alignment padding', () => {
			// float64 planned at byte 4 is aligned to 8: one padding unit plus two occupied units.
			const memory = { byteAddress: 8, elementWordSize: 8, allocationUnitCount: 3, endByteAddress: 12 };

			expect(renderAddress(memory, 0, true)).toBe('12');
		});
	});
});
