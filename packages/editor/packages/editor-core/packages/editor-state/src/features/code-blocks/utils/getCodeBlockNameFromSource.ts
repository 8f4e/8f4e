import { documentBlockInstructionByType } from '@8f4e/language-spec';
import { instructionParser } from '@8f4e/tokenizer';

const namedBlockStarts: ReadonlySet<string> = new Set([
	documentBlockInstructionByType.module.start,
	documentBlockInstructionByType.function.start,
	documentBlockInstructionByType.constants.start,
	documentBlockInstructionByType.prototype.start,
	documentBlockInstructionByType.note.start,
	documentBlockInstructionByType.includes.start,
	'group',
]);

/**
 * Returns the source-level block name from raw code when CodeBlockGraphicData.name is not available yet.
 */
export default function getCodeBlockNameFromSource(code: string[]): string {
	for (const line of code) {
		const match = line.match(instructionParser);
		const instruction = match?.[1];

		if (!instruction || !namedBlockStarts.has(instruction)) {
			continue;
		}

		return match[2]?.trim().split(/\s+/)[0] ?? '';
	}

	return '';
}
