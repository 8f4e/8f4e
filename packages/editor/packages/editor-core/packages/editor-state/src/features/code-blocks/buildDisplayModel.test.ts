import { describe, expect, it } from 'vitest';
import buildDisplayModel from './buildDisplayModel';

describe('buildDisplayModel', () => {
	it('returns a 1:1 display model for source lines', () => {
		const code = ['module foo', 'push 1', 'moduleEnd'];

		const result = buildDisplayModel(code);

		expect(result.lines).toEqual([
			{ sourceLineIndex: 0, text: 'module foo' },
			{ sourceLineIndex: 1, text: 'push 1' },
			{ sourceLineIndex: 2, text: 'moduleEnd' },
		]);
		expect(result.displayRowToSourceLineIndex).toEqual([0, 1, 2]);
		expect(result.sourceLineIndexToDisplayRow).toEqual([0, 1, 2]);
		expect(result.isCollapsed).toBe(false);
	});

	it('returns empty mappings for empty code', () => {
		const result = buildDisplayModel([]);

		expect(result.lines).toEqual([]);
		expect(result.displayRowToSourceLineIndex).toEqual([]);
		expect(result.sourceLineIndexToDisplayRow).toEqual([]);
		expect(result.isCollapsed).toBe(false);
	});

	it('hides everything after @hide while collapsed', () => {
		const code = ['module foo', '; @hide', 'push 1', 'push 2', 'moduleEnd'];

		const result = buildDisplayModel(code, { hideAfterSourceLineIndex: 1 });

		expect(result.lines).toEqual([
			{ sourceLineIndex: 0, text: 'module foo' },
			{ sourceLineIndex: 1, text: '; @hide' },
			{ sourceLineIndex: 1, text: '...', isPlaceholder: true },
		]);
		expect(result.displayRowToSourceLineIndex).toEqual([0, 1, 1]);
		expect(result.sourceLineIndexToDisplayRow).toEqual([0, 2, undefined, undefined, undefined]);
		expect(result.isCollapsed).toBe(true);
	});

	it('does not add a placeholder when @hide is already the last line', () => {
		const code = ['module foo', '; @hide'];

		const result = buildDisplayModel(code, { hideAfterSourceLineIndex: 1 });

		expect(result.lines).toEqual([
			{ sourceLineIndex: 0, text: 'module foo' },
			{ sourceLineIndex: 1, text: '; @hide' },
		]);
		expect(result.displayRowToSourceLineIndex).toEqual([0, 1]);
	});

	it('shows the full block while expanded for editing', () => {
		const code = ['module foo', '; @hide', 'push 1', 'moduleEnd'];

		const result = buildDisplayModel(code, {
			hideAfterSourceLineIndex: 1,
			isExpandedForEditing: true,
		});

		expect(result.displayRowToSourceLineIndex).toEqual([0, 1, 2, 3]);
		expect(result.sourceLineIndexToDisplayRow).toEqual([0, 1, 2, 3]);
		expect(result.isCollapsed).toBe(false);
	});
});
