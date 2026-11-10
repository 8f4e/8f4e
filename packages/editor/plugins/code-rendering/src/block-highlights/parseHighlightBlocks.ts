import { stackBlockInstructionPairs } from '@8f4e/language-spec';
import { instructionParser } from '@8f4e/tokenizer';

const endInstructionByStartInstruction = new Map<string, string>(
	stackBlockInstructionPairs.map(({ start, end }) => [start, end])
);
const endInstructions = new Set<string>(stackBlockInstructionPairs.map(({ end }) => end));

interface HighlightBlock {
	startInstruction: string;
	endInstruction: string;
	startLineNumber: number;
	endLineNumber?: number;
	depth: number;
}

function popLastOpenBlock(stack: HighlightBlock[] | undefined): HighlightBlock | undefined {
	if (!stack) {
		return undefined;
	}

	while (stack.length > 0) {
		const candidate = stack.pop();
		if (candidate && candidate.endLineNumber === undefined) {
			return candidate;
		}
	}

	return undefined;
}

export default function parseHighlightBlocks(code: string[]) {
	const blocks: HighlightBlock[] = [];
	const openBlocksByEndInstruction = new Map<string, HighlightBlock[]>();
	const openIfBlocks: HighlightBlock[] = [];
	let openBlockCount = 0;

	const pushOpenBlock = (block: HighlightBlock) => {
		const stack = openBlocksByEndInstruction.get(block.endInstruction);
		if (stack) {
			stack.push(block);
		} else {
			openBlocksByEndInstruction.set(block.endInstruction, [block]);
		}
	};

	code.forEach((line, lineIndex) => {
		const [, instruction] = (line.match(instructionParser) || []) as [never, string];

		const endInstruction = endInstructionByStartInstruction.get(instruction);
		if (endInstruction) {
			const block: HighlightBlock = {
				startInstruction: instruction,
				endInstruction,
				startLineNumber: lineIndex,
				endLineNumber: undefined,
				depth: openBlockCount,
			};
			blocks.push(block);
			pushOpenBlock(block);
			if (instruction === 'if' && endInstruction === 'ifEnd') {
				openIfBlocks.push(block);
			}
			openBlockCount += 1;
		}

		if (instruction === 'else') {
			const lastOpenIfBlock = popLastOpenBlock(openIfBlocks);

			if (lastOpenIfBlock) {
				lastOpenIfBlock.endLineNumber = lineIndex;
				const elseBlock: HighlightBlock = {
					startInstruction: 'else',
					endInstruction: 'ifEnd',
					startLineNumber: lineIndex,
					endLineNumber: undefined,
					depth: lastOpenIfBlock.depth,
				};
				blocks.push(elseBlock);
				pushOpenBlock(elseBlock);
			}
		}

		if (endInstructions.has(instruction)) {
			const lastOpenBlock = popLastOpenBlock(openBlocksByEndInstruction.get(instruction));

			if (lastOpenBlock) {
				lastOpenBlock.endLineNumber = lineIndex;
				openBlockCount -= 1;
			}
		}
	});

	return blocks;
}
