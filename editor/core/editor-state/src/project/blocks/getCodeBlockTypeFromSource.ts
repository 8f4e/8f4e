import { getDocumentProjectBlockType } from '@8f4e/project-preparser';

/**
 * Detects a flat document block type from its source markers. Group blocks are structurally owned by the editor.
 * @param code - Code block represented as an array of lines.
 * @returns The inferred code block type.
 */
export default function getCodeBlockTypeFromSource(code: string[]) {
	return getDocumentProjectBlockType(code);
}
