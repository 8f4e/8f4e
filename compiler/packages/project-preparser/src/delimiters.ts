import {
	documentBlockInstructionByType,
	documentBlockInstructionPairs,
	projectInstructions,
} from '@8f4e/language-spec';

export const FORMAT_HEADER = '8f4e/v1';
export const ENTRY_BLOCK_DELIMITER = { type: 'entry', ...projectInstructions.entry } as const;
export const GROUP_BLOCK_DELIMITER = { type: 'group', ...projectInstructions.group } as const;
export const INCLUDES_BLOCK_DELIMITER = {
	type: documentBlockInstructionByType.includes.type,
	opener: documentBlockInstructionByType.includes.start,
	closer: documentBlockInstructionByType.includes.end,
} as const;
export const BLOCK_DELIMITERS = documentBlockInstructionPairs.map(({ type, start, end }) => ({
	type,
	opener: start,
	closer: end,
}));

export const PROJECT_BLOCK_DELIMITERS = [
	...documentBlockInstructionPairs.map(({ start, end }) => ({ opener: start, closer: end })),
	{ opener: ENTRY_BLOCK_DELIMITER.opener, closer: ENTRY_BLOCK_DELIMITER.closer },
	{ opener: GROUP_BLOCK_DELIMITER.opener, closer: GROUP_BLOCK_DELIMITER.closer },
] as const;
