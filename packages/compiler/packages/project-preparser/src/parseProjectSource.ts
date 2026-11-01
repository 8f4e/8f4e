import type { DocumentBlockType, ProjectBlock, ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import {
	createProjectObjectModel,
	documentBlockInstructionByType,
	documentBlockInstructionPairs,
} from '@8f4e/language-spec';
import { ENTRY_BLOCK_DELIMITER, FORMAT_HEADER, GROUP_BLOCK_DELIMITER } from './delimiters';
import {
	getExpectedProjectCloserPrefix,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
	startsWithInstruction,
} from './projectKeywords';
import { getProjectBlockName, isProjectGapLine } from './projectLines';
import { parseProjectMemoryExposureLine } from './projectMemoryExposure';

type ParsedProjectBlock = { block: ProjectBlock; type: DocumentBlockType; nextIndex: number };

function hasDisabledDirective(code: readonly string[]): boolean {
	return code.some(line => /^\s*;\s*@disabled(?:\s|$)/.test(line));
}

/** Parses `.8f4e` text into the canonical compiler-owned project object model. */
export function parseProjectSource(text: string): ProjectObjectModel {
	const lines = text.split('\n');
	if (lines[0]?.trim() !== FORMAT_HEADER) {
		throw new Error(`Invalid .8f4e file: expected header "${FORMAT_HEADER}", got "${lines[0]?.trim() ?? ''}"`);
	}

	const project = createProjectObjectModel();

	function addParsedBlock(targetProject: ProjectObjectModel, parsed: ParsedProjectBlock, entry?: string): void {
		const { block, type } = parsed;
		if (type === 'module') {
			if (!entry) throw new Error(`Project module block ${block.id} is missing an entry`);
			if (!targetProject.entries.includes(entry)) {
				targetProject.entries.push(entry);
			}
			targetProject.execution.push({ ...block, type: 'module', entry });
			return;
		}
		const collectionByType = {
			function: targetProject.functions,
			constants: targetProject.constants,
			prototype: targetProject.prototypes,
			includes: targetProject.includes,
			note: targetProject.notes,
		};
		collectionByType[type].push(block);
	}

	function readProjectBlock(startIndex: number): ParsedProjectBlock {
		const openerLine = lines[startIndex];
		const openerKeyword = getProjectOpenerKeyword(openerLine.trim());
		if (
			!openerKeyword ||
			openerKeyword === ENTRY_BLOCK_DELIMITER.opener ||
			openerKeyword === GROUP_BLOCK_DELIMITER.opener
		) {
			throw new Error(`Parse error at line ${startIndex + 1}: expected document block opener`);
		}
		const blockType = documentBlockInstructionPairs.find(({ start }) => start === openerKeyword)?.type;
		if (!blockType) {
			throw new Error(`Parse error at line ${startIndex + 1}: unknown document block opener "${openerKeyword}"`);
		}

		const expectedCloser = getExpectedProjectCloserPrefix(openerKeyword);
		const currentBlockLines = [openerLine];
		for (let i = startIndex + 1; i < lines.length; i += 1) {
			const line = lines[i];
			const trimmed = line.trim();
			currentBlockLines.push(line);
			const closer = getProjectCloserKeyword(trimmed);
			if (blockType === 'note' && closer !== expectedCloser) {
				continue;
			}
			if (closer) {
				if (closer !== expectedCloser) {
					throw new Error(`Parse error at line ${i + 1}: closer "${closer}" does not match opener "${openerKeyword}"`);
				}
				return {
					block: {
						id: startIndex + 1,
						code: currentBlockLines,
						...(hasDisabledDirective(currentBlockLines) ? { disabled: true } : {}),
					},
					type: blockType,
					nextIndex: i + 1,
				};
			}
			if (trimmed !== '' && getProjectOpenerKeyword(trimmed)) {
				throw new Error(
					`Parse error at line ${i + 1}: mixed block type markers (found opener "${trimmed}" inside "${openerKeyword}" block)`
				);
			}
		}
		throw new Error(`Parse error: unclosed block with opener "${openerKeyword}"`);
	}

	function readEntry(startIndex: number, scope: ProjectObjectModel): number {
		const name = getProjectBlockName(lines[startIndex], startIndex + 1, 'entry');
		if (!scope.entries.includes(name)) scope.entries.push(name);
		return readScope(startIndex + 1, scope, { closer: ENTRY_BLOCK_DELIMITER.closer, entry: name });
	}

	function readGroup(startIndex: number, ambientEntry: string): { nextIndex: number; group: ProjectGroupObjectModel } {
		const openerLine = lines[startIndex];
		const group: ProjectGroupObjectModel = {
			...createProjectObjectModel(),
			type: 'group',
			id: startIndex + 1,
			name: getProjectBlockName(openerLine, startIndex + 1, 'group'),
			entry: ambientEntry,
			code: [openerLine],
			exposures: [],
		};
		const nextIndex = readScope(startIndex + 1, group, { closer: GROUP_BLOCK_DELIMITER.closer, group });
		return { nextIndex, group };
	}

	/** Root and group scopes share structural parsing; entry sections only select module membership. */
	function readScope(
		startIndex: number,
		scope: ProjectObjectModel,
		options: { closer?: string; entry?: string; group?: ProjectGroupObjectModel } = {}
	): number {
		let pendingGapLines: string[] = [];
		for (let i = startIndex; i < lines.length; ) {
			const line = lines[i];
			const trimmed = line.trim();
			const closer = getProjectCloserKeyword(trimmed);
			if (closer) {
				if (closer !== options.closer) throw new Error(`Parse error at line ${i + 1}: unexpected closer "${closer}"`);
				if (options.group) scope.code.push(line);
				else if (!options.entry && scope.code.length) scope.code.push(...pendingGapLines);
				return i + 1;
			}
			if (isProjectGapLine(trimmed)) {
				if (options.group) scope.code.push(line);
				else if (!options.entry) pendingGapLines.push(line);
				i += 1;
				continue;
			}
			if (startsWithInstruction(trimmed, 'expose') && options.group) {
				const exposure = parseProjectMemoryExposureLine(trimmed, i + 1);
				if (options.group.exposures.some(item => item.name === exposure.name))
					throw new Error(`Parse error at line ${i + 1}: duplicate exposure "${exposure.name}"`);
				options.group.exposures.push(exposure);
				scope.code.push(line);
				i += 1;
				continue;
			}
			const opener = getProjectOpenerKeyword(trimmed);
			if (!opener) {
				if (options.entry)
					throw new Error(
						`Parse error at line ${i + 1}: entry "${options.entry}" can only contain module or group blocks, got "${trimmed}"`
					);
				if (!options.group && !startsWithInstruction(trimmed, 'pass') && !startsWithInstruction(trimmed, 'init')) {
					throw new Error(`Parse error at line ${i + 1}: expected opener keyword, got "${trimmed}"`);
				}
				if (!options.group && scope.code.length === 0)
					while (pendingGapLines[0]?.trim() === '') pendingGapLines.shift();
				scope.code.push(...pendingGapLines, line);
				pendingGapLines = [];
				i += 1;
				continue;
			}
			pendingGapLines = [];
			if (opener === ENTRY_BLOCK_DELIMITER.opener) {
				if (options.entry)
					throw new Error(`Parse error at line ${i + 1}: entry blocks cannot be nested inside entries`);
				i = readEntry(i, scope);
				continue;
			}
			if (opener === GROUP_BLOCK_DELIMITER.opener) {
				if (!options.entry) throw new Error(`Parse error at line ${i + 1}: group blocks must be inside an entry block`);
				const nested = readGroup(i, options.entry);
				if (scope.execution.some(block => block.type === 'group' && block.name === nested.group.name))
					throw new Error(`Parse error at line ${i + 1}: duplicate sibling group "${nested.group.name}"`);
				if (!scope.entries.includes(nested.group.entry)) scope.entries.push(nested.group.entry);
				scope.execution.push(nested.group);
				i = nested.nextIndex;
				continue;
			}
			if (options.entry && opener !== documentBlockInstructionByType.module.start)
				throw new Error(
					`Parse error at line ${i + 1}: entry "${options.entry}" can only contain module or group blocks, got "${trimmed}"`
				);
			const parsed = readProjectBlock(i);
			if (parsed.type === 'module' && !options.entry)
				throw new Error(`Parse error at line ${i + 1}: module blocks must be inside an entry block`);
			addParsedBlock(scope, parsed, options.entry);
			i = parsed.nextIndex;
		}
		if (options.closer) throw new Error(`Parse error: unclosed block with closer "${options.closer}"`);
		if (scope.code.length) scope.code.push(...pendingGapLines);
		return lines.length;
	}

	readScope(1, project);
	return project;
}
