import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import updateBlockGaps from './updateBlockGaps';

describe('updateBlockGaps', () => {
	it('inserts contributed gaps using display rows', () => {
		const editorBlock = createMockCodeBlock({
			code: ['module foo', '; layout space', 'push 1', 'moduleEnd'],
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'module foo' },
					{ sourceLineIndex: 1, text: '; layout space' },
					{ sourceLineIndex: 3, text: 'moduleEnd' },
				],
				displayRowToSourceLineIndex: [0, 1, 3],
				sourceLineIndexToDisplayRow: [0, 1, undefined, 2],
				isCollapsed: false,
			},
		});

		updateBlockGaps(editorBlock, [{ sourceLineIndex: 3, heightInRows: 8 }]);

		expect(editorBlock.gaps.get(2)).toEqual({ size: 8 });
	});

	it('adds multiple vertical-space requests on the same display row', () => {
		const editorBlock = createMockCodeBlock({ code: ['module foo', 'int value', 'moduleEnd'] });

		updateBlockGaps(editorBlock, [
			{ sourceLineIndex: 1, heightInRows: 2 },
			{ sourceLineIndex: 1, heightInRows: 3 },
		]);

		expect(editorBlock.gaps.get(1)).toEqual({ size: 5 });
	});

	it('skips gaps for source lines hidden from the display model', () => {
		const editorBlock = createMockCodeBlock({
			code: ['module foo', '; layout space', 'push 1', 'moduleEnd'],
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'module foo' },
					{ sourceLineIndex: 3, text: 'moduleEnd' },
				],
				displayRowToSourceLineIndex: [0, 3],
				sourceLineIndexToDisplayRow: [0, undefined, undefined, 1],
				isCollapsed: true,
			},
		});

		updateBlockGaps(editorBlock, [{ sourceLineIndex: 1, heightInRows: 8 }]);

		expect(editorBlock.gaps.size).toBe(0);
	});
});
