import { describe, expect, it } from 'vitest';
import { CODE_BLOCK_MIN_GRID_WIDTH } from './blockSizeDefaults';
import getCodeBlockGridWidth from './getCodeBlockGridWidth';

describe('getCodeBlockGridWidth', () => {
	it('returns minGridWidth when code is shorter', () => {
		const code = ['short', 'lines'];
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => []),
				50
			)
		).toBe(50);
	});

	it('returns calculated width when code is longer than minGridWidth', () => {
		const code = ['module test', 'this is a much longer line of code', 'moduleEnd'];
		// Line numbers: "0 ", "1 ", "2 " (2 chars each)
		// Longest line with line number: "1 this is a much longer line of code" = 36 chars
		// Width = 36 + 4 = 40
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => [])
			)
		).toBe(40);
	});

	it('accounts for multi-digit line numbers', () => {
		// Create 100 lines to ensure line numbers go to 3 digits
		const code = Array(100)
			.fill(0)
			.map((_, i) => 'line ' + i);
		// Line numbers: "000 ", "001 ", ..., "099 " (4 chars each)
		// Sample line: "099 line 99" = 11 chars
		// Width = 11 + 4 = 15
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => []),
				10
			)
		).toBe(15);
	});

	it('uses default minGridWidth of CODE_BLOCK_MIN_GRID_WIDTH when not specified', () => {
		const code = ['x'];
		// Line number: "0 " (2 chars)
		// Line: "0 x" = 3 chars
		// Width = max(CODE_BLOCK_MIN_GRID_WIDTH, 3 + 4) = max(32, 7) = 32
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => [])
			)
		).toBe(CODE_BLOCK_MIN_GRID_WIDTH);
	});

	it('handles empty code array', () => {
		const code: string[] = [];
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => [])
			)
		).toBe(CODE_BLOCK_MIN_GRID_WIDTH);
	});

	it('matches project width calculation logic', () => {
		// This test verifies the exact formula used in project
		const code = ['module delay', '', 'float[] buffer 44100', 'moduleEnd'];
		// Lines: "0 module delay", "1 ", "2 float[] buffer 44100", "3 moduleEnd"
		// Longest: "2 float[] buffer 44100" = 22 chars
		// Width = max(32, 22 + 4) = max(32, 26) = 32
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => [])
			)
		).toBe(CODE_BLOCK_MIN_GRID_WIDTH);

		// Test with longer line
		const longCode = ['module test', 'this is a very long line that exceeds the minimum grid width value'];
		expect(
			getCodeBlockGridWidth(
				longCode,
				longCode.map(() => [])
			)
		).toBe(72); // "0 this is a very long line that exceeds the minimum grid width value" = 68 + 4 = 72
	});

	it('uses tab-expanded visual width instead of raw string length', () => {
		const code = ['; @tab 20 24', '\tb'];
		expect(
			getCodeBlockGridWidth(
				code,
				code.map(() => [20, 24]),
				1
			)
		).toBe(27);
	});

	it('uses the most recent tab directive for each line', () => {
		const code = ['; @tab 4 8', '\tb', '; @tab 20 24', '\tb'];
		expect(
			getCodeBlockGridWidth(
				code,
				[
					[4, 8],
					[4, 8],
					[20, 24],
					[20, 24],
				],
				1
			)
		).toBe(27);
	});
});
