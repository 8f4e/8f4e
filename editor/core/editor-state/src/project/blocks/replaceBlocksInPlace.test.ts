import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/__tests__/helpers/mockEditorState';
import replaceBlocksInPlace from './replaceBlocksInPlace';

describe('replaceBlocksInPlace', () => {
	it('preserves the project slice identity while replacing its contents', () => {
		const originalBlock = createMockCodeBlock({ name: 'original' });
		const replacementBlock = createMockCodeBlock({ name: 'replacement' });
		const projectSlice = [originalBlock];
		const renderedSlice = projectSlice;

		replaceBlocksInPlace(renderedSlice, [replacementBlock]);

		expect(renderedSlice).toBe(projectSlice);
		expect(projectSlice).toEqual([replacementBlock]);
	});
});
