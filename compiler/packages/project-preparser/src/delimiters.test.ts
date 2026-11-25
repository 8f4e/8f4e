import { documentBlockInstructionPairs } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import {
	BLOCK_DELIMITERS,
	ENTRY_BLOCK_DELIMITER,
	FORMAT_HEADER,
	GROUP_BLOCK_DELIMITER,
	INCLUDES_BLOCK_DELIMITER,
	PROJECT_BLOCK_DELIMITERS,
} from './delimiters';

describe('FORMAT_HEADER', () => {
	it('matches the project parser format marker', () => {
		expect(FORMAT_HEADER).toBe('8f4e/v1');
	});
});

describe('project block delimiters', () => {
	it('defines the project containers', () => {
		expect(ENTRY_BLOCK_DELIMITER).toEqual({ type: 'entry', opener: 'entry', closer: 'entryEnd' });
		expect(GROUP_BLOCK_DELIMITER).toEqual({ type: 'group', opener: 'group', closer: 'groupEnd' });
		expect(INCLUDES_BLOCK_DELIMITER).toEqual({ type: 'includes', opener: 'includes', closer: 'includesEnd' });
	});

	it('derives document block delimiters from the language spec', () => {
		expect(BLOCK_DELIMITERS).toEqual(
			documentBlockInstructionPairs.map(({ type, start, end }) => ({ type, opener: start, closer: end }))
		);
	});

	it('combines document and project-only delimiters for project keyword detection', () => {
		expect(PROJECT_BLOCK_DELIMITERS).toEqual([
			...documentBlockInstructionPairs.map(({ start, end }) => ({ opener: start, closer: end })),
			{ opener: 'entry', closer: 'entryEnd' },
			{ opener: 'group', closer: 'groupEnd' },
		]);
	});
});
