import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/__tests__/helpers/mockEditorState';
import replaceCodeBlocksInPlace from './replaceBlocksInPlace';

describe('replaceCodeBlocksInPlace', () => {
	it('preserves the project slice identity while replacing its contents', () => {
		const originalBlock = createMockCodeBlock({ name: 'original' });
		const replacementBlock = createMockCodeBlock({ name: 'replacement' });
		const projectSlice = [originalBlock];
		const renderedSlice = projectSlice;

		replaceCodeBlocksInPlace(renderedSlice, [replacementBlock]);

		expect(renderedSlice).toBe(projectSlice);
		expect(projectSlice).toEqual([replacementBlock]);
	});
});
