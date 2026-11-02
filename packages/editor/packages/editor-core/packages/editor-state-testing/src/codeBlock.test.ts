import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from './index';

/**
 * Normalize a block for snapshot testing by converting Maps to arrays
 * and setting lastUpdated to a fixed value
 */
function normalizeBlock(block: CodeBlockGraphicData) {
	return {
		...block,
		lastUpdated: 0,
		gaps: Array.from(block.gaps.entries()),
	};
}

describe('createMockCodeBlock', () => {
	describe('default values', () => {
		it('should create a block with default values when called with no arguments', () => {
			const block = createMockCodeBlock();
			expect(normalizeBlock(block)).toMatchSnapshot();
		});
	});

	describe('override behavior', () => {
		it('should override position and dimensions', () => {
			const block = createMockCodeBlock({ x: 200, y: 300, width: 200, height: 150 });
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should override the block name', () => {
			const block = createMockCodeBlock({ name: 'custom-block' });
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should allow independent override of minGridWidth', () => {
			const block = createMockCodeBlock({ x: 100, y: 200, minGridWidth: 64 });
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should allow override of code and other properties', () => {
			const block = createMockCodeBlock({
				code: ['line1', 'line2'],
				lineNumberColumnWidth: 3,
			});
			expect(normalizeBlock(block)).toMatchSnapshot();
		});
	});

	describe('cursor calculation', () => {
		it('should calculate cursor position correctly', () => {
			const block = createMockCodeBlock({ x: 100, y: 200, width: 200, height: 150 });
			// Cursor X = x + width/2 = 100 + 200/2 = 200
			// Cursor Y (relative) = height/2 = 150/2 = 75
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should use cursorY convenience parameter', () => {
			const block = createMockCodeBlock({ x: 100, y: 200, width: 200, height: 150, cursorY: 110 });
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should prefer explicit cursor override over cursorY', () => {
			const block = createMockCodeBlock({
				x: 100,
				y: 200,
				cursorY: 110,
				cursor: { col: 5, row: 3, x: 999, y: 999 },
			});
			expect(normalizeBlock(block)).toMatchSnapshot();
		});
	});

	describe('edge cases', () => {
		it('should handle negative coordinates', () => {
			const block = createMockCodeBlock({ x: -100, y: -200 });
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should handle zero dimensions', () => {
			const block = createMockCodeBlock({ width: 0, height: 0 });
			expect(normalizeBlock(block)).toMatchSnapshot();
		});

		it('should create independent block instances', () => {
			const block1 = createMockCodeBlock({ name: 'block1', x: 100 });
			const block2 = createMockCodeBlock({ name: 'block2', x: 200 });

			expect(block1.name).toBe('block1');
			expect(block2.name).toBe('block2');
			expect(block1.x).toBe(100);
			expect(block2.x).toBe(200);
			// Maps should be independent
			expect(block1.gaps).not.toBe(block2.gaps);
		});
	});
});
