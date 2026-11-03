import type { DocumentBlockType, ProjectBlock, ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import {
	createProjectObjectModel,
	documentBlockInstructionByType,
	documentBlockInstructionPairs,
} from '@8f4e/language-spec';
import { FORMAT_HEADER } from './delimiters';
import { startsWithInstruction } from './projectKeywords';
import { getProjectBlockName, isProjectGapLine } from './projectLines';
import { parseProjectMemoryExposureLine } from './projectMemoryExposure';
import { isBlock, readProjectSource, type SourceBlock, type SourceNode, sourceLines } from './projectSource';
import { inlineProjectTemplates } from './projectTemplates';

function hasDisabledDirective(code: readonly string[]): boolean {
	return code.some(line => /^\s*;\s*@disabled(?:\s|$)/.test(line));
}

/** Parses `.8f4e` text into the canonical compiler-owned project object model. */
export function parseProjectSource(text: string): ProjectObjectModel {
	const source = inlineProjectTemplates(text);
	const header = source.split('\n', 1)[0].trim();
	if (header !== FORMAT_HEADER)
		throw new Error(`Invalid .8f4e file: expected header "${FORMAT_HEADER}", got "${header}"`);
	const project = createProjectObjectModel();

	function addBlock(target: ProjectObjectModel, node: SourceBlock, type: DocumentBlockType, entry?: string): void {
		const code = sourceLines([node]);
		const block: ProjectBlock = {
			id: node.start.lineNumber,
			code,
			...(hasDisabledDirective(code) ? { disabled: true } : {}),
		};
		if (type === 'module') {
			if (!entry)
				throw new Error(`Parse error at line ${node.start.lineNumber}: module blocks must be inside an entry block`);
			if (!target.entries.includes(entry)) target.entries.push(entry);
			target.execution.push({ ...block, type: 'module', entry });
		} else {
			const collections = {
				function: target.functions,
				constants: target.constants,
				prototype: target.prototypes,
				includes: target.includes,
				note: target.notes,
			};
			collections[type].push(block);
		}
	}

	function readGroup(node: SourceBlock, entry: string): ProjectGroupObjectModel {
		const group: ProjectGroupObjectModel = {
			...createProjectObjectModel(),
			type: 'group',
			id: node.start.lineNumber,
			name: getProjectBlockName(node.start.text, node.start.lineNumber, 'group'),
			entry,
			code: [node.start.text],
			exposures: [],
		};
		readScope(node.children, group, { group });
		group.code.push(node.end.text);
		return group;
	}

	function readScope(
		nodes: SourceNode[],
		scope: ProjectObjectModel,
		options: { entry?: string; group?: ProjectGroupObjectModel } = {}
	): void {
		let pendingGapLines: string[] = [];
		for (const node of nodes) {
			if (!isBlock(node)) {
				const line = node.text;
				const trimmed = line.trim();
				if (isProjectGapLine(trimmed)) {
					if (options.group) scope.code.push(line);
					else if (!options.entry) pendingGapLines.push(line);
					continue;
				}
				if (startsWithInstruction(trimmed, 'expose') && options.group) {
					const exposure = parseProjectMemoryExposureLine(trimmed, node.lineNumber);
					if (options.group.exposures.some(item => item.name === exposure.name))
						throw new Error(`Parse error at line ${node.lineNumber}: duplicate exposure "${exposure.name}"`);
					options.group.exposures.push(exposure);
					scope.code.push(line);
					continue;
				}
				if (options.entry)
					throw new Error(
						`Parse error at line ${node.lineNumber}: entry "${options.entry}" can only contain module or group blocks, got "${trimmed}"`
					);
				if (!options.group && !startsWithInstruction(trimmed, 'pass') && !startsWithInstruction(trimmed, 'init'))
					throw new Error(`Parse error at line ${node.lineNumber}: expected opener keyword, got "${trimmed}"`);
				if (!options.group && scope.code.length === 0)
					while (pendingGapLines[0]?.trim() === '') pendingGapLines.shift();
				scope.code.push(...pendingGapLines, line);
				pendingGapLines = [];
				continue;
			}
			pendingGapLines = [];
			if (node.opener === 'entry') {
				if (options.entry)
					throw new Error(`Parse error at line ${node.start.lineNumber}: entry blocks cannot be nested inside entries`);
				const name = getProjectBlockName(node.start.text, node.start.lineNumber, 'entry');
				if (!scope.entries.includes(name)) scope.entries.push(name);
				readScope(node.children, scope, { entry: name });
				continue;
			}
			if (node.opener === 'group') {
				if (!options.entry)
					throw new Error(`Parse error at line ${node.start.lineNumber}: group blocks must be inside an entry block`);
				const group = readGroup(node, options.entry);
				if (scope.execution.some(block => block.type === 'group' && block.name === group.name))
					throw new Error(`Parse error at line ${node.start.lineNumber}: duplicate sibling group "${group.name}"`);
				if (!scope.entries.includes(group.entry)) scope.entries.push(group.entry);
				scope.execution.push(group);
				continue;
			}
			if (options.entry && node.opener !== documentBlockInstructionByType.module.start)
				throw new Error(
					`Parse error at line ${node.start.lineNumber}: entry "${options.entry}" can only contain module or group blocks, got "${node.start.text.trim()}"`
				);
			const type = documentBlockInstructionPairs.find(({ start }) => start === node.opener)!.type;
			addBlock(scope, node, type, options.entry);
		}
		if (!options.entry && scope.code.length) scope.code.push(...pendingGapLines);
	}

	readScope(readProjectSource(source).slice(1), project);
	return project;
}
