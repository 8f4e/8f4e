import type { DocumentBlockType } from '@8f4e/language-spec';
import { compilableBlockTypes, documentBlockInstructionByType } from '@8f4e/language-spec';
import { isProjectGapLine } from '@8f4e/tokenizer';
import { BLOCK_DELIMITERS } from './delimiters';
import { getProjectCloserKeyword, getProjectOpenerKeyword, startsWithInstruction } from './projectKeywords';

const blockDelimiters = compilableBlockTypes.map(type => documentBlockInstructionByType[type]);

/**
 * Gets project block type.
 *
 * @param code - Source lines to process.
 * @returns Resolved project block type.
 */
export function getProjectBlockType(code: string[]): DocumentBlockType | 'unknown' {
	for (const line of code) {
		const trimmed = line.trim();
		if (isProjectGapLine(trimmed)) {
			continue;
		}
		const blockDelimiter = blockDelimiters.find(({ start }) => startsWithInstruction(trimmed, start));
		if (blockDelimiter) return blockDelimiter.type;
		break;
	}
	return 'unknown';
}

/**
 * Gets document project block type.
 *
 * @param code - Source lines to process.
 * @returns Resolved document project block type.
 */
export function getDocumentProjectBlockType(code: string[]): DocumentBlockType | 'unknown' {
	const trimmedLines = code.map(line => line.trim());
	const markerMatches = BLOCK_DELIMITERS.map(({ type, opener, closer }) => ({
		type,
		hasOpener: trimmedLines.some(line => getProjectOpenerKeyword(line) === opener),
		hasCloser: trimmedLines.some(line => getProjectCloserKeyword(line) === closer),
	}));
	const presentTypes = markerMatches.filter(({ hasOpener, hasCloser }) => hasOpener || hasCloser);

	if (presentTypes.length !== 1) {
		return 'unknown';
	}

	const [match] = presentTypes;
	return match.hasOpener && match.hasCloser ? match.type : 'unknown';
}
