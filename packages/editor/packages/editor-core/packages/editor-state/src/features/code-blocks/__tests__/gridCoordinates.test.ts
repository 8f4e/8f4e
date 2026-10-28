import type { State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it } from 'vitest';

import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';

describe('Grid Coordinates Integration', () => {
	let mockState: Pick<State, 'codeBlockRendering' | 'viewport'>;

	beforeEach(() => {
		mockState = {
			codeBlockRendering: {
				codeBlocks: [],
			} as State['codeBlockRendering'],
			viewport: {
				vGrid: 8, // characterWidth
				hGrid: 16, // characterHeight
				x: 0,
				y: 0,
			},
		};
	});

	describe('Code Block Creation', () => {
		it('should initialize grid coordinates from pixel coordinates', () => {
			// Create a code block at pixel position (80, 160)
			const codeBlock = createMockCodeBlock({
				x: 80,
				y: 160,
				gridX: Math.round(80 / 8),
				gridY: Math.round(160 / 16),
			});

			expect(codeBlock.gridX).toBe(10);
			expect(codeBlock.gridY).toBe(10);
			expect(codeBlock.x).toBe(80);
			expect(codeBlock.y).toBe(160);
		});

		it('should handle non-aligned pixel positions by rounding', () => {
			// Create a code block at non-aligned pixel position (85, 165)
			const codeBlock = createMockCodeBlock({
				x: 85,
				y: 165,
				gridX: Math.round(85 / 8),
				gridY: Math.round(165 / 16),
			});

			expect(codeBlock.gridX).toBe(11); // Math.round(85/8) = 11
			expect(codeBlock.gridY).toBe(10); // Math.round(165/16) = 10
		});
	});

	describe('Drag and Drop Snap', () => {
		it('should update grid coordinates after drag', () => {
			const codeBlock = createMockCodeBlock({
				x: 80,
				y: 160,
				gridX: 10,
				gridY: 10,
			});

			// Simulate drag to new position (94, 178)
			codeBlock.x = 94;
			codeBlock.y = 178;

			// Simulate drag end snap (from codeBlockDragger.ts)
			const newGridX = Math.round(codeBlock.x / mockState.viewport.vGrid);
			const newGridY = Math.round(codeBlock.y / mockState.viewport.hGrid);
			codeBlock.gridX = newGridX;
			codeBlock.gridY = newGridY;
			codeBlock.x = newGridX * mockState.viewport.vGrid;
			codeBlock.y = newGridY * mockState.viewport.hGrid;

			expect(codeBlock.gridX).toBe(12); // Math.round(94/8) = 12
			expect(codeBlock.gridY).toBe(11); // Math.round(178/16) = 11
			expect(codeBlock.x).toBe(96); // 12 * 8
			expect(codeBlock.y).toBe(176); // 11 * 16
		});
	});

	describe('Font Change', () => {
		it('should recompute pixel coordinates from grid when font changes', () => {
			const codeBlock = createMockCodeBlock({
				gridX: 10,
				gridY: 10,
				x: 80,
				y: 160,
			});

			mockState.codeBlockRendering.codeBlocks.push(codeBlock);

			// Verify initial state with 8x16 font
			expect(codeBlock.x).toBe(80);
			expect(codeBlock.y).toBe(160);

			// Simulate installing a regenerated atlas with a 6x10 font.
			const newCharacterWidth = 6;
			const newCharacterHeight = 10;
			mockState.viewport.vGrid = newCharacterWidth;
			mockState.viewport.hGrid = newCharacterHeight;

			// Recompute pixel positions from grid coordinates
			for (const block of mockState.codeBlockRendering.codeBlocks) {
				block.x = block.gridX * newCharacterWidth;
				block.y = block.gridY * newCharacterHeight;
			}

			// Grid coordinates should remain unchanged
			expect(codeBlock.gridX).toBe(10);
			expect(codeBlock.gridY).toBe(10);

			// Pixel coordinates should be recomputed
			expect(codeBlock.x).toBe(60); // 10 * 6
			expect(codeBlock.y).toBe(100); // 10 * 10
		});

		it('should maintain relative positions between code blocks after font change', () => {
			const block1 = createMockCodeBlock({
				name: 'block1',
				gridX: 5,
				gridY: 5,
				x: 40,
				y: 80,
			});

			const block2 = createMockCodeBlock({
				name: 'block2',
				gridX: 15,
				gridY: 15,
				x: 120,
				y: 240,
			});

			mockState.codeBlockRendering.codeBlocks.push(block1);
			mockState.codeBlockRendering.codeBlocks.push(block2);

			// Calculate initial grid spacing
			const initialGridSpacingX = block2.gridX - block1.gridX;
			const initialGridSpacingY = block2.gridY - block1.gridY;
			expect(initialGridSpacingX).toBe(10);
			expect(initialGridSpacingY).toBe(10);

			// Simulate font change to 6x10
			mockState.viewport.vGrid = 6;
			mockState.viewport.hGrid = 10;

			for (const block of mockState.codeBlockRendering.codeBlocks) {
				block.x = block.gridX * 6;
				block.y = block.gridY * 10;
			}

			// Grid spacing should remain unchanged
			const finalGridSpacingX = block2.gridX - block1.gridX;
			const finalGridSpacingY = block2.gridY - block1.gridY;
			expect(finalGridSpacingX).toBe(initialGridSpacingX);
			expect(finalGridSpacingY).toBe(initialGridSpacingY);

			// Pixel positions should be updated
			expect(block1.x).toBe(30); // 5 * 6
			expect(block1.y).toBe(50); // 5 * 10
			expect(block2.x).toBe(90); // 15 * 6
			expect(block2.y).toBe(150); // 15 * 10
		});
	});

	describe('Project Import/Export', () => {
		it('should preserve grid coordinates through serialization cycle', () => {
			const originalBlock = createMockCodeBlock({
				name: 'test-module',
				code: ['module test', 'moduleEnd'],
				gridX: 12,
				gridY: 8,
				x: 96,
				y: 128,
			});

			// Simulate serialization (from serializeCodeBlocks.ts)
			const serialized = {
				code: originalBlock.code,
				gridCoordinates: {
					x: originalBlock.gridX,
					y: originalBlock.gridY,
				},
			};

			expect(serialized.gridCoordinates.x).toBe(12);
			expect(serialized.gridCoordinates.y).toBe(8);

			// Simulate import with different font (from projectLoading.ts)
			const newVGrid = 6;
			const newHGrid = 10;
			const importedBlock = createMockCodeBlock({
				name: 'test-module',
				code: serialized.code,
				gridX: serialized.gridCoordinates.x,
				gridY: serialized.gridCoordinates.y,
				x: serialized.gridCoordinates.x * newVGrid,
				y: serialized.gridCoordinates.y * newHGrid,
			});

			// Grid coordinates should be preserved
			expect(importedBlock.gridX).toBe(originalBlock.gridX);
			expect(importedBlock.gridY).toBe(originalBlock.gridY);

			// Pixel coordinates should be recomputed for new font
			expect(importedBlock.x).toBe(72); // 12 * 6
			expect(importedBlock.y).toBe(80); // 8 * 10
		});
	});
});
