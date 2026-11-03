import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import {
	ArgumentType,
	arrayMemoryDeclarationInstructions,
	type CompilerASTLine,
	isMemoryDeclarationLine,
	scalarMemoryDeclarationInstructions,
} from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';
import getCodeBlockModuleId from '~/pureHelpers/getCodeBlockModuleId';

const scalarMemoryDeclarationInstructionSet = new Set<string>(scalarMemoryDeclarationInstructions);
const arrayMemoryDeclarationInstructionSet = new Set<string>(arrayMemoryDeclarationInstructions);
function escapeRegExp(text: string): string {
	return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSourceLine(line: string, lineNumber: number): CompilerASTLine | undefined {
	try {
		return parseLine(line, lineNumber);
	} catch {
		return undefined;
	}
}

function getMemoryDeclarationId(line: string, lineNumber: number, isArray = false): string | undefined {
	const parsedLine = parseSourceLine(line, lineNumber);
	if (
		!parsedLine ||
		!isMemoryDeclarationLine(parsedLine) ||
		!(isArray ? arrayMemoryDeclarationInstructionSet : scalarMemoryDeclarationInstructionSet).has(
			parsedLine.instruction
		)
	) {
		return undefined;
	}

	const [firstArg] = parsedLine.arguments;
	if (firstArg?.type !== ArgumentType.IDENTIFIER || firstArg.referenceKind !== 'plain') {
		return undefined;
	}

	return firstArg.value;
}

function replaceMemoryDeclarationDefault(
	line: string,
	memoryId: string,
	value: string,
	isArray = false
): string | undefined {
	const [body = '', comment] = line.split(/;(.*)/s);
	const pattern = new RegExp(
		`^(?<prefix>\\s*\\S+\\s+${escapeRegExp(memoryId)}${isArray ? '\\s+\\S+' : ''})(?<defaults>(?:\\s+\\S+)*)?(?<trailingWhitespace>\\s*)$`
	);
	const groups = pattern.exec(body)?.groups;
	if (!groups?.prefix) {
		return undefined;
	}

	return `${groups.prefix}${value ? ` ${value}` : ''}${comment !== undefined ? ` ;${comment}` : ''}`;
}

export interface MemoryDefaultValue {
	moduleId: string;
	memoryId: string;
	value: string;
	isArray: boolean;
}

export interface MemoryDefaultEdit {
	codeBlock: CodeBlockGraphicData;
	code: string[];
}

/** Routes groups of resolved memory defaults to their source owners. Each group is saved together. */
export function getMemoryDefaultEdits(state: State, groups: MemoryDefaultValue[][]): MemoryDefaultEdit[] {
	const owners = new Map<string, CodeBlockGraphicData>();
	const collectOwners = (blocks: CodeBlockGraphicData[]) => {
		for (const block of blocks) {
			if (block.childProject !== undefined) collectOwners(block.childProject?.blocks);
			else if (block.blockType === 'module') owners.set(getCodeBlockModuleId(block), block);
		}
	};
	collectOwners(state.codeBlockRendering.rootProject.blocks);

	const updates = new Map<CodeBlockGraphicData, string[]>();
	for (const group of groups) {
		const edits = group.map(edit => {
			const owner = owners.get(edit.moduleId);
			if (!owner) return;
			const code = updates.get(owner) ?? owner.code;
			const row = code.findIndex(
				(line, index) => getMemoryDeclarationId(line, index + 1, edit.isArray) === edit.memoryId
			);
			if (row === -1) return;
			const line = replaceMemoryDeclarationDefault(code[row], edit.memoryId, edit.value, edit.isArray);
			return line === undefined ? undefined : { owner, row, line };
		});
		// Save a group only when all of its declarations can be updated, including across different owners.
		if (!edits.every(edit => edit !== undefined)) continue;
		for (const edit of edits) {
			const code = updates.get(edit.owner) ?? [...edit.owner.code];
			code[edit.row] = edit.line;
			updates.set(edit.owner, code);
		}
	}

	return [...updates].flatMap(([codeBlock, code]) =>
		code.some((line, row) => line !== codeBlock.code[row]) ? [{ codeBlock, code }] : []
	);
}
