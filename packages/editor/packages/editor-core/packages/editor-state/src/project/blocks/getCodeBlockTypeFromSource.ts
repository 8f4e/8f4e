import type { CodeBlockType } from '@8f4e/editor-state-types';
import { getDocumentProjectBlockType } from '@8f4e/project-preparser';

/**
 * Detects whether a block of code represents a module, config, function, note, or unknown block by scanning for marker pairs.
 * @param code - Code block represented as an array of lines.
 * @returns The inferred code block type.
 */
export default function getBlockType(code: string[]): CodeBlockType {
	return getDocumentProjectBlockType(code) as CodeBlockType;
}
