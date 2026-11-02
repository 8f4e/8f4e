import { isMemoryDeclarationInstructionName } from '@8f4e/language-spec';
import { getPointerDepth } from '@8f4e/tokenizer';

export default function getLineNumberPrefix(
	displayRow: number,
	width: number,
	sourceLine: string,
	isPlaceholder: boolean
): string {
	const instruction = sourceLine.match(/^\s*([^\s;]+)/)?.[1];
	if (
		!isPlaceholder &&
		instruction !== undefined &&
		isMemoryDeclarationInstructionName(instruction) &&
		getPointerDepth(instruction) > 0
	) {
		return ''.padStart(width + 1, ' ');
	}
	return `${displayRow}`.padStart(width, '0') + ' ';
}
