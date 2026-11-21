import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import findClosestCodeBlockInDirection from './findClosestCodeBlockInDirection';

describe('findClosestCodeBlockInDirection', () => {
	describe('right direction', () => {
		it('should find the closest block to the right', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 });
			const right1 = createMockCodeBlock({ name: 'right1', x: 200, y: 0 });
			const right2 = createMockCodeBlock({ name: 'right2', x: 400, y: 0 });
			const codeBlocks = [selected, right1, right2];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('right1');
		});

		it('should find closest block to cursor for horizontal navigation', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 }); // cursor at (50, 50)
			const closeButMisaligned = createMockCodeBlock({ name: 'close', x: 150, y: 200 }); // center at (200, 250), Y distance = 200
			const alignedButFarther = createMockCodeBlock({ name: 'aligned', x: 300, y: 10 }); // center at (350, 60), Y distance = 10
			const codeBlocks = [selected, closeButMisaligned, alignedButFarther];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			// With Y-only distance for horizontal navigation, aligned is closer vertically
			// close: Y distance = |250 - 50| = 200
			// aligned: Y distance = |60 - 50| = 10
			expect(result.name).toBe('aligned');
		});

		it('should return selected block if no blocks to the right', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 100, y: 0 });
			const left = createMockCodeBlock({ name: 'left', x: 0, y: 0 });
			const codeBlocks = [selected, left];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('selected');
		});
	});

	describe('left direction', () => {
		it('should find the closest block to the left', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 400, y: 0 });
			const left1 = createMockCodeBlock({ name: 'left1', x: 200, y: 0 });
			const left2 = createMockCodeBlock({ name: 'left2', x: 0, y: 0 });
			const codeBlocks = [selected, left1, left2];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'left');

			expect(result.name).toBe('left1');
		});

		it('should return selected block if no blocks to the left', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 });
			const right = createMockCodeBlock({ name: 'right', x: 200, y: 0 });
			const codeBlocks = [selected, right];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'left');

			expect(result.name).toBe('selected');
		});
	});

	describe('up direction', () => {
		it('should find the closest block above', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 400 });
			const up1 = createMockCodeBlock({ name: 'up1', x: 0, y: 200 });
			const up2 = createMockCodeBlock({ name: 'up2', x: 0, y: 0 });
			const codeBlocks = [selected, up1, up2];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'up');

			expect(result.name).toBe('up1');
		});

		it('should prefer aligned blocks over closer misaligned blocks', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 400 });
			const closeButMisaligned = createMockCodeBlock({ name: 'close', x: 200, y: 250 }); // Closer but far horizontally
			const alignedButFarther = createMockCodeBlock({ name: 'aligned', x: 10, y: 100 }); // Farther but more aligned
			const codeBlocks = [selected, closeButMisaligned, alignedButFarther];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'up');

			// With edge-based calculation and ALIGNMENT_WEIGHT = 2.0:
			// close: primaryDistance=400-350=50, secondaryDistance=200, score=450
			// aligned: primaryDistance=400-200=200, secondaryDistance=10, score=220
			expect(result.name).toBe('aligned');
		});

		it('should return selected block if no blocks above', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 });
			const down = createMockCodeBlock({ name: 'down', x: 0, y: 200 });
			const codeBlocks = [selected, down];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'up');

			expect(result.name).toBe('selected');
		});
	});

	describe('down direction', () => {
		it('should find the closest block below', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 });
			const down1 = createMockCodeBlock({ name: 'down1', x: 0, y: 200 });
			const down2 = createMockCodeBlock({ name: 'down2', x: 0, y: 400 });
			const codeBlocks = [selected, down1, down2];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');

			expect(result.name).toBe('down1');
		});

		it('should return selected block if no blocks below', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 200 });
			const up = createMockCodeBlock({ name: 'up', x: 0, y: 0 });
			const codeBlocks = [selected, up];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');

			expect(result.name).toBe('selected');
		});
	});

	describe('edge cases', () => {
		it('should handle only the selected block', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 });
			const codeBlocks = [selected];

			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'right').name).toBe('selected');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'left').name).toBe('selected');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'up').name).toBe('selected');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'down').name).toBe('selected');
		});

		it('should handle empty list by returning selected block', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0 });
			const codeBlocks: CodeBlockGraphicData[] = [];
			codeBlocks.push(selected);

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('selected');
		});

		it('should handle overlapping positions', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 100, y: 100 });
			const overlap = createMockCodeBlock({ name: 'overlap', x: 100, y: 100 });
			const right = createMockCodeBlock({ name: 'right', x: 300, y: 100 });
			const codeBlocks = [selected, overlap, right];

			// Even though overlap is at same position, center calculation means it won't be selected
			// when looking right, the 'right' block should be found
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('right');
		});

		it('should use center points for distance calculation', () => {
			// Test that blocks are compared using their center points
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0, width: 100, height: 100 }); // center at (50, 50)
			const right = createMockCodeBlock({ name: 'right', x: 150, y: 0, width: 100, height: 100 }); // center at (200, 50)
			const codeBlocks = [selected, right];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('right');
		});

		it('should handle blocks with different dimensions', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0, width: 50, height: 50 });
			const largeRight = createMockCodeBlock({ name: 'largeRight', x: 200, y: 0, width: 200, height: 200 });
			const smallRight = createMockCodeBlock({ name: 'smallRight', x: 400, y: 0, width: 25, height: 25 });
			const codeBlocks = [selected, largeRight, smallRight];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			// With weighted approach (primary distance + Y distance * 2):
			// selected cursor: (25, 25), right edge: 50
			// largeRight: left edge 200, center (300, 100)
			//   primary = 200-50 = 150, Y distance = 75, score = 150 + 75*2 = 300
			// smallRight: left edge 400, center (412.5, 12.5)
			//   primary = 400-50 = 350, Y distance = 12.5, score = 350 + 12.5*2 = 375
			expect(result.name).toBe('largeRight');
		});
	});

	describe('complex scenarios', () => {
		it('should handle a grid of blocks correctly', () => {
			// Create a 3x3 grid of blocks
			const selected = createMockCodeBlock({ name: 'center', x: 200, y: 200 });
			const topLeft = createMockCodeBlock({ name: 'topLeft', x: 0, y: 0 });
			const top = createMockCodeBlock({ name: 'top', x: 200, y: 0 });
			const topRight = createMockCodeBlock({ name: 'topRight', x: 400, y: 0 });
			const left = createMockCodeBlock({ name: 'left', x: 0, y: 200 });
			const right = createMockCodeBlock({ name: 'right', x: 400, y: 200 });
			const bottomLeft = createMockCodeBlock({ name: 'bottomLeft', x: 0, y: 400 });
			const bottom = createMockCodeBlock({ name: 'bottom', x: 200, y: 400 });
			const bottomRight = createMockCodeBlock({ name: 'bottomRight', x: 400, y: 400 });

			const codeBlocks = [selected, topLeft, top, topRight, left, right, bottomLeft, bottom, bottomRight];

			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'up').name).toBe('top');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'down').name).toBe('bottom');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'left').name).toBe('left');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'right').name).toBe('right');
		});

		it('should handle when multiple blocks are at equal distance', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 200, y: 200 });
			const right1 = createMockCodeBlock({ name: 'right1', x: 400, y: 200 });
			const right2 = createMockCodeBlock({ name: 'right2', x: 400, y: 200 });
			const codeBlocks = [selected, right1, right2];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			// Should return one of them deterministically (first found)
			expect(['right1', 'right2']).toContain(result.name);
		});
	});

	describe('all four directions independently', () => {
		it('should navigate in all four directions from a central block', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 200, y: 200 });
			const up = createMockCodeBlock({ name: 'up', x: 200, y: 0 });
			const down = createMockCodeBlock({ name: 'down', x: 200, y: 400 });
			const left = createMockCodeBlock({ name: 'left', x: 0, y: 200 });
			const right = createMockCodeBlock({ name: 'right', x: 400, y: 200 });
			const codeBlocks = [selected, up, down, left, right];

			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'up').name).toBe('up');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'down').name).toBe('down');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'left').name).toBe('left');
			expect(findClosestCodeBlockInDirection(codeBlocks, selected, 'right').name).toBe('right');
		});
	});

	describe('edge-based navigation (diagonal and staggered layouts)', () => {
		it('should prefer directly below block over diagonally closer block when moving down', () => {
			// Setup: selected block at (0, 0), directlyBelow at (0, 200), diagonalCloser at (80, 150)
			// With edge-based logic:
			// - directlyBelow: primaryDistance = 200-100 = 100, secondaryDistance = 0, score = 100
			// - diagonalCloser: primaryDistance = 150-100 = 50, secondaryDistance = 80, score = 50 + 80*2 = 210
			// directlyBelow should win despite being farther away
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0, width: 100, height: 100 });
			const directlyBelow = createMockCodeBlock({ name: 'directlyBelow', x: 0, y: 200, width: 100, height: 100 });
			const diagonalCloser = createMockCodeBlock({ name: 'diagonalCloser', x: 80, y: 150, width: 100, height: 100 });
			const codeBlocks = [selected, directlyBelow, diagonalCloser];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');

			expect(result.name).toBe('directlyBelow');
		});

		it('should prefer directly above block over diagonally closer block when moving up', () => {
			// Setup similar to above but for upward movement
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 300, width: 100, height: 100 });
			const directlyAbove = createMockCodeBlock({ name: 'directlyAbove', x: 0, y: 100, width: 100, height: 100 });
			const diagonalCloser = createMockCodeBlock({ name: 'diagonalCloser', x: 80, y: 150, width: 100, height: 100 });
			const codeBlocks = [selected, directlyAbove, diagonalCloser];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'up');

			expect(result.name).toBe('directlyAbove');
		});

		it('should find closest block to cursor when moving right', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0, width: 100, height: 100 }); // cursor at (50, 50)
			const directlyRight = createMockCodeBlock({ name: 'directlyRight', x: 200, y: 0, width: 100, height: 100 }); // center at (250, 50), Y distance=0
			const diagonalCloser = createMockCodeBlock({ name: 'diagonalCloser', x: 150, y: 80, width: 100, height: 100 }); // center at (200, 130), Y distance=80
			const codeBlocks = [selected, directlyRight, diagonalCloser];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			// With Y-only distance, directlyRight is at the same vertical level (Y distance = 0)
			expect(result.name).toBe('directlyRight');
		});

		it('should find closest block to cursor when moving left', () => {
			const selected = createMockCodeBlock({ name: 'selected', x: 300, y: 0, width: 100, height: 100 }); // cursor at (350, 50)
			const directlyLeft = createMockCodeBlock({ name: 'directlyLeft', x: 100, y: 0, width: 100, height: 100 }); // center at (150, 50), Y distance=0
			const diagonalCloser = createMockCodeBlock({ name: 'diagonalCloser', x: 150, y: 80, width: 100, height: 100 }); // center at (200, 130), Y distance=80
			const codeBlocks = [selected, directlyLeft, diagonalCloser];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'left');

			// With Y-only distance, directlyLeft is at the same vertical level (Y distance = 0)
			expect(result.name).toBe('directlyLeft');
		});

		it('should handle staggered vertical layout correctly', () => {
			// Create a staggered layout:
			//   [A]
			//      [B]  <- selected
			//   [C]
			//      [D]
			const selected = createMockCodeBlock({ name: 'B', x: 200, y: 100, width: 100, height: 80 });
			const blockA = createMockCodeBlock({ name: 'A', x: 50, y: 0, width: 100, height: 80 });
			const blockC = createMockCodeBlock({ name: 'C', x: 50, y: 200, width: 100, height: 80 });
			const blockD = createMockCodeBlock({ name: 'D', x: 200, y: 300, width: 100, height: 80 });
			const codeBlocks = [selected, blockA, blockC, blockD];

			// Moving up should go to A (even though it's offset)
			const upResult = findClosestCodeBlockInDirection(codeBlocks, selected, 'up');
			expect(upResult.name).toBe('A');

			// Moving down should go to D (directly below, even though C is also below)
			const downResult = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');
			expect(downResult.name).toBe('D');
		});

		it('should handle staggered horizontal layout correctly', () => {
			// Create a staggered layout:
			//   [A]  [B-selected]  [C]  [D]
			//         (B slightly lower)
			const selected = createMockCodeBlock({ name: 'B', x: 200, y: 100, width: 100, height: 80 });
			const blockA = createMockCodeBlock({ name: 'A', x: 0, y: 50, width: 100, height: 80 });
			const blockC = createMockCodeBlock({ name: 'C', x: 400, y: 50, width: 100, height: 80 });
			const blockD = createMockCodeBlock({ name: 'D', x: 600, y: 100, width: 100, height: 80 });
			const codeBlocks = [selected, blockA, blockC, blockD];

			// Moving left with cursor Y=140 (100 + 40):
			// A: Y range [50, 130], cursor 140 is NOT in range - no movement
			const leftResult = findClosestCodeBlockInDirection(codeBlocks, selected, 'left');
			expect(leftResult.name).toBe('B'); // Stays at selected block

			// Moving right with Y-overlap priority:
			// selected cursor: absolute Y = 100 + 40 = 140
			// C: Y range [50, 130], cursor 140 is NOT in range
			// D: Y range [100, 180], cursor 140 IS in range
			// D wins because cursor Y overlaps with its vertical range
			const rightResult = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');
			expect(rightResult.name).toBe('D');
		});

		it('should use edge-based filtering to exclude overlapping blocks', () => {
			// Selected block: x=100, y=100, width=100, height=100
			//   → boundaries: left=100, top=100, right=200, bottom=200
			// Overlapping block: x=150, y=150, width=100, height=100
			//   → boundaries: left=150, top=150, right=250, bottom=250
			//   → top (150) is NOT >= selected's bottom (200), so it gets filtered out
			// Properly below block: x=100, y=250, width=100, height=100
			//   → boundaries: left=100, top=250, right=200, bottom=350
			//   → top (250) >= selected's bottom (200), so it passes the filter
			const selected = createMockCodeBlock({ name: 'selected', x: 100, y: 100, width: 100, height: 100 });
			const overlapping = createMockCodeBlock({ name: 'overlapping', x: 150, y: 150, width: 100, height: 100 });
			const properlyBelow = createMockCodeBlock({ name: 'properlyBelow', x: 100, y: 250, width: 100, height: 100 });
			const codeBlocks = [selected, overlapping, properlyBelow];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');

			// Edge-based filtering excludes 'overlapping' because its top edge (150) is below
			// the selected block's top (100) but above its bottom edge (200), making it overlap.
			// Only 'properlyBelow' passes the filter: top >= selectedBottom (250 >= 200).
			expect(result.name).toBe('properlyBelow');
		});

		it('should handle edge case where blocks are adjacent with no gap', () => {
			// Blocks that touch edge-to-edge (no gap between them)
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0, width: 100, height: 100 });
			const adjacent = createMockCodeBlock({ name: 'adjacent', x: 0, y: 100, width: 100, height: 100 }); // top edge exactly at selected's bottom
			const codeBlocks = [selected, adjacent];

			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');

			// Should find adjacent with 0 primary distance
			expect(result.name).toBe('adjacent');
		});

		it('should prioritize alignment with increased weight', () => {
			// With ALIGNMENT_WEIGHT = 2.0, test that alignment is more important
			const selected = createMockCodeBlock({ name: 'selected', x: 100, y: 100, width: 100, height: 100 });
			// farAligned: far but perfectly aligned
			const farAligned = createMockCodeBlock({ name: 'farAligned', x: 100, y: 300, width: 100, height: 100 });
			// closeMisaligned: closer but significantly misaligned
			const closeMisaligned = createMockCodeBlock({ name: 'closeMisaligned', x: 250, y: 220, width: 100, height: 100 });
			const codeBlocks = [selected, farAligned, closeMisaligned];

			// farAligned: primary = 300-200 = 100, secondary = 0, score = 100
			// closeMisaligned: primary = 220-200 = 20, secondary = 200, score = 20 + 200*2 = 420
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');

			expect(result.name).toBe('farAligned');
		});
	});

	describe('cursor-aware horizontal navigation', () => {
		it('should use cursor Y position for horizontal navigation when provided', () => {
			// Tall selected block (height=300) with cursor near the top at Y=110
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 300,
				cursorY: 110,
			});
			// Two neighbors to the right at different heights
			const topNeighbor = createMockCodeBlock({ name: 'topNeighbor', x: 200, y: 50, width: 100, height: 100 });
			const bottomNeighbor = createMockCodeBlock({ name: 'bottomNeighbor', x: 200, y: 200, width: 100, height: 100 });
			const codeBlocks = [selected, topNeighbor, bottomNeighbor];

			// Cursor at Y=110, topNeighbor center at Y=100, bottomNeighbor center at Y=250
			// topNeighbor: distance from cursor = |100 - 110| = 10
			// bottomNeighbor: distance from cursor = |250 - 110| = 140
			// topNeighbor should win
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('topNeighbor');
		});

		it('should prefer bottom neighbor when cursor is near the bottom of tall block', () => {
			// Tall selected block (height=300) with cursor near the bottom at Y=280
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 300,
				cursorY: 280,
			});
			// Two neighbors to the right at different heights
			const topNeighbor = createMockCodeBlock({ name: 'topNeighbor', x: 200, y: 50, width: 100, height: 100 });
			const bottomNeighbor = createMockCodeBlock({ name: 'bottomNeighbor', x: 200, y: 200, width: 100, height: 100 });
			const codeBlocks = [selected, topNeighbor, bottomNeighbor];

			// Cursor at Y=280, topNeighbor center at Y=100, bottomNeighbor center at Y=250
			// topNeighbor: distance from cursor = |100 - 280| = 180
			// bottomNeighbor: distance from cursor = |250 - 280| = 30
			// bottomNeighbor should win
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('bottomNeighbor');
		});

		it('should work with left navigation and cursor position', () => {
			// Selected block with cursor near the top
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 400,
				y: 0,
				width: 100,
				height: 300,
				cursorY: 110,
			});
			// Two neighbors to the left at different heights
			const topNeighbor = createMockCodeBlock({ name: 'topNeighbor', x: 200, y: 50, width: 100, height: 100 });
			const bottomNeighbor = createMockCodeBlock({ name: 'bottomNeighbor', x: 200, y: 200, width: 100, height: 100 });
			const codeBlocks = [selected, topNeighbor, bottomNeighbor];

			// Cursor at Y=110, topNeighbor center at Y=100, bottomNeighbor center at Y=250
			// topNeighbor should win due to cursor proximity
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'left');

			expect(result.name).toBe('topNeighbor');
		});

		it('should handle multiple neighbors and choose closest to cursor', () => {
			// Tall selected block with cursor in the middle
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 400,
				cursorY: 200,
			});
			// Multiple neighbors at different heights
			const top = createMockCodeBlock({ name: 'top', x: 200, y: 0, width: 100, height: 80 });
			const upperMiddle = createMockCodeBlock({ name: 'upperMiddle', x: 200, y: 100, width: 100, height: 80 });
			const middle = createMockCodeBlock({ name: 'middle', x: 200, y: 180, width: 100, height: 80 }); // Center at Y=220
			const lowerMiddle = createMockCodeBlock({ name: 'lowerMiddle', x: 200, y: 260, width: 100, height: 80 });
			const bottom = createMockCodeBlock({ name: 'bottom', x: 200, y: 340, width: 100, height: 80 });
			const codeBlocks = [selected, top, upperMiddle, middle, lowerMiddle, bottom];

			// Cursor at Y=200, middle center at Y=220 (distance=20)
			// All others are farther from Y=200
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('middle');
		});

		it('should fall back to block center when cursor position is not provided', () => {
			// Selected block without cursor position
			const selected = createMockCodeBlock({ name: 'selected', x: 0, y: 0, width: 100, height: 300 });
			// Two neighbors at different heights
			const topNeighbor = createMockCodeBlock({ name: 'topNeighbor', x: 200, y: 50, width: 100, height: 100 });
			const bottomNeighbor = createMockCodeBlock({ name: 'bottomNeighbor', x: 200, y: 200, width: 100, height: 100 });
			const codeBlocks = [selected, topNeighbor, bottomNeighbor];

			// Without cursor, selected center is at Y=150
			// topNeighbor center at Y=100 (distance=50)
			// bottomNeighbor center at Y=250 (distance=100)
			// topNeighbor should win
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('topNeighbor');
		});

		it('should not affect vertical navigation (up/down)', () => {
			// Selected block with cursor position
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 200,
				width: 100,
				height: 100,
				cursorY: 250,
			});
			// Blocks above and below
			const above = createMockCodeBlock({ name: 'above', x: 0, y: 0, width: 100, height: 100 });
			const below = createMockCodeBlock({ name: 'below', x: 0, y: 400, width: 100, height: 100 });
			const codeBlocks = [selected, above, below];

			// Vertical navigation should use block centers, not cursor
			const upResult = findClosestCodeBlockInDirection(codeBlocks, selected, 'up');
			expect(upResult.name).toBe('above');

			const downResult = findClosestCodeBlockInDirection(codeBlocks, selected, 'down');
			expect(downResult.name).toBe('below');
		});

		it('should handle cursor at the edge of a tall block', () => {
			// Very tall selected block with cursor at the very top
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 500,
				cursorY: 10,
			});
			// Multiple neighbors spanning the height
			const veryTop = createMockCodeBlock({ name: 'veryTop', x: 200, y: 0, width: 100, height: 100 });
			const middle = createMockCodeBlock({ name: 'middle', x: 200, y: 200, width: 100, height: 100 });
			const bottom = createMockCodeBlock({ name: 'bottom', x: 200, y: 400, width: 100, height: 100 });
			const codeBlocks = [selected, veryTop, middle, bottom];

			// Cursor at Y=10, veryTop center at Y=50 (distance=40)
			// middle and bottom are much farther
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('veryTop');
		});

		it('should handle cursor near neighbor boundaries', () => {
			// Selected block with cursor at Y=150
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 300,
				cursorY: 150,
			});
			// Neighbor that spans Y=100 to Y=200 (center at Y=150)
			const perfectMatch = createMockCodeBlock({ name: 'perfectMatch', x: 200, y: 100, width: 100, height: 100 });
			// Other neighbor
			const other = createMockCodeBlock({ name: 'other', x: 200, y: 250, width: 100, height: 100 });
			const codeBlocks = [selected, perfectMatch, other];

			// Cursor at Y=150 perfectly matches perfectMatch center
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('perfectMatch');
		});

		it('should find closest block to cursor position regardless of alignment', () => {
			// Selected block with cursor at (50, 100)
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 200,
				cursorY: 100,
			});
			// Close but vertically misaligned neighbor
			const closeButMisaligned = createMockCodeBlock({ name: 'close', x: 150, y: 300, width: 100, height: 100 }); // Center at (200, 350), Y distance = 250
			// Farther but vertically aligned neighbor
			const farButAligned = createMockCodeBlock({ name: 'aligned', x: 300, y: 80, width: 100, height: 100 }); // Center at (350, 130), Y distance = 30
			const codeBlocks = [selected, closeButMisaligned, farButAligned];

			// With Y-only distance, aligned is much closer vertically
			// close: Y distance = |350 - 100| = 250
			// aligned: Y distance = |130 - 100| = 30
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('aligned');
		});

		it('should prefer blocks that overlap with cursor Y position over those that do not', () => {
			// Selected block with cursor in the middle
			const selected = createMockCodeBlock({
				name: 'selected',
				x: 0,
				y: 0,
				width: 100,
				height: 400,
				cursorY: 200,
			});
			// Three neighbors at same horizontal distance
			const top = createMockCodeBlock({ name: 'top', x: 200, y: 0, width: 100, height: 100 }); // Range [0, 100]
			const middle = createMockCodeBlock({ name: 'middle', x: 200, y: 150, width: 100, height: 100 }); // Range [150, 250] - overlaps cursor at 200
			const bottom = createMockCodeBlock({ name: 'bottom', x: 200, y: 300, width: 100, height: 100 }); // Range [300, 400]
			const codeBlocks = [selected, top, middle, bottom];

			// Cursor at Y=200
			// top: range [0,100], cursor not in range, distance = 200-100 = 100
			// middle: range [150,250], cursor IS in range, distance = 0
			// bottom: range [300,400], cursor not in range, distance = 300-200 = 100
			// All have same primary distance, so middle wins due to overlap
			const result = findClosestCodeBlockInDirection(codeBlocks, selected, 'right');

			expect(result.name).toBe('middle');
		});
	});
});
