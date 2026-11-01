import type {
	DocumentBlockType,
	ProjectBlock,
	ProjectGroupObjectModel,
	ProjectMemoryExposure,
	ProjectObjectModel,
} from '@8f4e/language-spec';
import { documentBlockInstructionByType, documentBlockInstructionPairs } from '@8f4e/language-spec';
import { ENTRY_BLOCK_DELIMITER, FORMAT_HEADER, GROUP_BLOCK_DELIMITER } from './delimiters';
import {
	getExpectedProjectCloserPrefix,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
	startsWithInstruction,
} from './projectKeywords';
import { getProjectBlockName, isProjectGapLine } from './projectLines';
import { parseProjectMemoryExposureLine } from './projectMemoryExposure';

type ProjectContainerDelimiter = { opener: string; closer: string };
type ProjectContainerContentOptions = {
	project: ProjectObjectModel;
	entry: string;
	container: ProjectContainerDelimiter;
	validateDocumentOpener: (opener: string, line: string, lineNumber: number) => void;
	exposures?: ProjectMemoryExposure[];
	rootCode?: string[];
};
type ParsedProjectBlock = { block: ProjectBlock; type: DocumentBlockType; nextIndex: number };

function createEmptyProject(): ProjectObjectModel {
	return {
		code: [],
		execution: [],
		functions: [],
		constants: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
	};
}

function createEmptyProjectGroup(id: number, name: string, entry: string, openerLine: string): ProjectGroupObjectModel {
	return {
		...createEmptyProject(),
		type: 'group',
		id,
		name,
		entry,
		code: [openerLine],
		exposures: [],
	};
}

function hasDisabledDirective(code: readonly string[]): boolean {
	return code.some(line => /^\s*;\s*@disabled(?:\s|$)/.test(line));
}

/** Parses `.8f4e` text into the canonical compiler-owned project object model. */
export function parseProjectSource(text: string): ProjectObjectModel {
	const lines = text.split('\n');
	if (lines[0]?.trim() !== FORMAT_HEADER) {
		throw new Error(`Invalid .8f4e file: expected header "${FORMAT_HEADER}", got "${lines[0]?.trim() ?? ''}"`);
	}

	const project = createEmptyProject();
	const seenEntryNames = new Set<string>();

	function addParsedBlock(targetProject: ProjectObjectModel, parsed: ParsedProjectBlock, entry?: string): void {
		const { block, type } = parsed;
		if (type === 'module') {
			if (!entry) throw new Error(`Project module block ${block.id} is missing an entry`);
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

	function readProjectContainerContents(startIndex: number, options: ProjectContainerContentOptions): number {
		for (let i = startIndex; i < lines.length; ) {
			const line = lines[i];
			const trimmed = line.trim();
			const closer = getProjectCloserKeyword(trimmed);
			if (closer === options.container.closer) {
				options.rootCode?.push(line);
				return i + 1;
			}
			if (closer) {
				throw new Error(
					`Parse error at line ${i + 1}: closer "${closer}" does not match opener "${options.container.opener}"`
				);
			}
			if (isProjectGapLine(trimmed)) {
				options.rootCode?.push(line);
				i += 1;
				continue;
			}
			if (startsWithInstruction(trimmed, 'init')) {
				(options.rootCode ?? options.project.code).push(line);
				i += 1;
				continue;
			}
			if (options.exposures && startsWithInstruction(trimmed, 'expose')) {
				const exposure = parseProjectMemoryExposureLine(trimmed, i + 1);
				if (options.exposures.some(candidate => candidate.name === exposure.name)) {
					throw new Error(`Parse error at line ${i + 1}: duplicate exposure "${exposure.name}"`);
				}
				options.exposures.push(exposure);
				options.rootCode?.push(line);
				i += 1;
				continue;
			}

			const opener = getProjectOpenerKeyword(trimmed);
			if (!opener && options.rootCode) {
				options.rootCode.push(line);
				i += 1;
				continue;
			}
			if (!opener) throw new Error(`Parse error at line ${i + 1}: expected opener keyword, got "${trimmed}"`);
			if (opener === GROUP_BLOCK_DELIMITER.opener) {
				const nested = readProjectGroup(i, options.entry);
				if (options.project.execution.some(block => block.type === 'group' && block.name === nested.group.name)) {
					throw new Error(`Parse error at line ${i + 1}: duplicate sibling group "${nested.group.name}"`);
				}
				options.project.execution.push(nested.group);
				i = nested.nextIndex;
				continue;
			}

			options.validateDocumentOpener(opener, trimmed, i + 1);
			const parsed = readProjectBlock(i);
			addParsedBlock(options.project, parsed, options.entry);
			i = parsed.nextIndex;
		}
		throw new Error(`Parse error: unclosed block with opener "${options.container.opener}"`);
	}

	function readProjectGroup(startIndex: number, entry: string): { nextIndex: number; group: ProjectGroupObjectModel } {
		const openerLine = lines[startIndex];
		if (getProjectOpenerKeyword(openerLine.trim()) !== GROUP_BLOCK_DELIMITER.opener) {
			throw new Error(`Parse error at line ${startIndex + 1}: expected group opener`);
		}
		const group = createEmptyProjectGroup(
			startIndex + 1,
			getProjectBlockName(openerLine, startIndex + 1, 'group'),
			entry,
			openerLine
		);
		return {
			nextIndex: readProjectContainerContents(startIndex + 1, {
				project: group,
				entry,
				container: GROUP_BLOCK_DELIMITER,
				exposures: group.exposures,
				rootCode: group.code,
				validateDocumentOpener: (opener, _line, lineNumber) => {
					if (opener === ENTRY_BLOCK_DELIMITER.opener) {
						throw new Error(`Parse error at line ${lineNumber}: entry blocks cannot be nested inside groups`);
					}
				},
			}),
			group,
		};
	}

	let pendingRootGapLines: string[] = [];
	for (let i = 1; i < lines.length; ) {
		const trimmed = lines[i].trim();
		if (isProjectGapLine(trimmed)) {
			pendingRootGapLines.push(lines[i]);
			i += 1;
			continue;
		}
		const opener = getProjectOpenerKeyword(trimmed);
		if (!opener) {
			const closer = getProjectCloserKeyword(trimmed);
			if (closer) {
				throw new Error(`Parse error at line ${i + 1}: unexpected closer "${closer}"`);
			}
			if (!startsWithInstruction(trimmed, 'pass') && !startsWithInstruction(trimmed, 'init')) {
				throw new Error(`Parse error at line ${i + 1}: expected opener keyword, got "${trimmed}"`);
			}
			if (project.code.length === 0) {
				while (pendingRootGapLines[0]?.trim() === '') {
					pendingRootGapLines.shift();
				}
			}
			project.code.push(...pendingRootGapLines, lines[i]);
			pendingRootGapLines = [];
			i += 1;
			continue;
		}
		pendingRootGapLines = [];

		if (opener !== ENTRY_BLOCK_DELIMITER.opener) {
			if (opener === documentBlockInstructionByType.module.start) {
				throw new Error(`Parse error at line ${i + 1}: module blocks must be inside an entry block`);
			}
			if (opener === GROUP_BLOCK_DELIMITER.opener) {
				throw new Error(`Parse error at line ${i + 1}: group blocks must be inside an entry block`);
			}
			const parsed = readProjectBlock(i);
			addParsedBlock(project, parsed);
			i = parsed.nextIndex;
			continue;
		}

		const entryName = getProjectBlockName(trimmed, i + 1, 'entry');
		if (seenEntryNames.has(entryName)) {
			throw new Error(`Parse error at line ${i + 1}: duplicate entry "${entryName}"`);
		}
		seenEntryNames.add(entryName);
		i = readProjectContainerContents(i + 1, {
			project,
			entry: entryName,
			container: ENTRY_BLOCK_DELIMITER,
			validateDocumentOpener: (innerOpener, line, lineNumber) => {
				if (innerOpener !== documentBlockInstructionByType.module.start) {
					throw new Error(
						`Parse error at line ${lineNumber}: entry "${entryName}" can only contain module or group blocks, got "${line}"`
					);
				}
			},
		});
	}
	if (project.code.length > 0) {
		project.code.push(...pendingRootGapLines);
	}

	return project;
}
