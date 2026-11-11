import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import type { DocumentBlockType, ProjectBlock, ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import {
	createProjectObjectModel,
	documentBlockInstructionByType,
	documentBlockInstructionPairs,
} from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { FORMAT_HEADER } from './delimiters';
import { startsWithInstruction } from './projectKeywords';
import { getProjectBlockName, isProjectGapLine } from './projectLines';
import { parseProjectMemoryExposureLine } from './projectMemoryExposure';
import {
	isBlock,
	readProjectSource,
	type SourceBlock,
	type SourceLine,
	type SourceNode,
	sourceLines,
} from './projectSource';
import { inlineProjectTemplates } from './projectTemplates';

type ScopeContext =
	| { kind: 'root'; project: ProjectObjectModel }
	| { kind: 'group'; project: ProjectGroupObjectModel }
	| { kind: 'entry'; project: ProjectObjectModel; name: string };

function hasDisabledDirective(code: readonly string[]): boolean {
	return code.some(line => /^\s*;\s*@disabled(?:\s|$)/.test(line));
}

function addBlock(target: ProjectObjectModel, node: SourceBlock, type: DocumentBlockType, entry?: string): void {
	const code = sourceLines([node]);
	const block: ProjectBlock = {
		id: node.start.lineNumber,
		code,
		...(hasDisabledDirective(code) ? { disabled: true } : {}),
	};
	if (type === 'module') {
		if (!entry)
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Parse error at line ${node.start.lineNumber}: module blocks must be inside an entry block`,
				{ kind: 'document' },
				{ lineNumber: node.start.lineNumber - 1 }
			);
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
	readScope(node.children, { kind: 'group', project: group });
	group.code.push(node.end.text);
	return group;
}

function readScopeLine(node: SourceLine, context: ScopeContext, pendingGapLines: string[]): void {
	const line = node.text;
	const trimmed = line.trim();
	const { project } = context;
	if (context.kind === 'group') {
		if (startsWithInstruction(trimmed, 'expose')) {
			const exposure = parseProjectMemoryExposureLine(trimmed, node.lineNumber);
			if (context.project.exposures.some(item => item.name === exposure.name))
				throw syntaxErrorAt(
					SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
					`Parse error at line ${node.lineNumber}: duplicate exposure "${exposure.name}"`,
					{ kind: 'document' },
					{ lineNumber: node.lineNumber - 1 }
				);
			context.project.exposures.push(exposure);
		}
		project.code.push(line);
		return;
	}
	if (isProjectGapLine(trimmed)) {
		if (context.kind === 'root') pendingGapLines.push(line);
		return;
	}
	if (context.kind === 'entry')
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${node.lineNumber}: entry "${context.name}" can only contain module or group blocks, got "${trimmed}"`,
			{ kind: 'document' },
			{ lineNumber: node.lineNumber - 1 }
		);
	if (!startsWithInstruction(trimmed, 'pass') && !startsWithInstruction(trimmed, 'init'))
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${node.lineNumber}: expected opener keyword, got "${trimmed}"`,
			{ kind: 'document' },
			{ lineNumber: node.lineNumber - 1 }
		);
	if (project.code.length === 0) while (pendingGapLines[0]?.trim() === '') pendingGapLines.shift();
	project.code.push(...pendingGapLines, line);
	pendingGapLines.length = 0;
}

function readScopeBlock(node: SourceBlock, context: ScopeContext): void {
	const { project } = context;
	if (node.opener === 'entry') {
		if (context.kind === 'entry')
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Parse error at line ${node.start.lineNumber}: entry blocks cannot be nested inside entries`,
				{ kind: 'document' },
				{ lineNumber: node.start.lineNumber - 1 }
			);
		const name = getProjectBlockName(node.start.text, node.start.lineNumber, 'entry');
		if (!project.entries.includes(name)) project.entries.push(name);
		readScope(node.children, { kind: 'entry', project, name });
		return;
	}
	if (node.opener === 'group') {
		if (context.kind !== 'entry')
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Parse error at line ${node.start.lineNumber}: group blocks must be inside an entry block`,
				{ kind: 'document' },
				{ lineNumber: node.start.lineNumber - 1 }
			);
		const group = readGroup(node, context.name);
		if (project.execution.some(block => block.type === 'group' && block.name === group.name))
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Parse error at line ${node.start.lineNumber}: duplicate sibling group "${group.name}"`,
				{ kind: 'document' },
				{ lineNumber: node.start.lineNumber - 1 }
			);
		project.execution.push(group);
		return;
	}
	const entry = context.kind === 'entry' ? context.name : undefined;
	if (entry && node.opener !== documentBlockInstructionByType.module.start)
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${node.start.lineNumber}: entry "${entry}" can only contain module or group blocks, got "${node.start.text.trim()}"`,
			{ kind: 'document' },
			{ lineNumber: node.start.lineNumber - 1 }
		);
	const type = documentBlockInstructionPairs.find(({ start }) => start === node.opener)!.type;
	addBlock(project, node, type, entry);
}

function readScope(nodes: SourceNode[], context: ScopeContext): void {
	const pendingGapLines: string[] = [];
	for (const node of nodes) {
		if (isBlock(node)) {
			pendingGapLines.length = 0;
			readScopeBlock(node, context);
		} else readScopeLine(node, context, pendingGapLines);
	}
	if (context.kind === 'root' && context.project.code.length) context.project.code.push(...pendingGapLines);
}

/** Parses `.8f4e` text into the canonical compiler-owned project object model. */
export function parseProjectSource(text: string): ProjectObjectModel {
	const source = inlineProjectTemplates(text);
	const header = source.split('\n', 1)[0].trim();
	if (header !== FORMAT_HEADER)
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Invalid .8f4e file: expected header "${FORMAT_HEADER}", got "${header}"`,
			{ kind: 'document' },
			{ lineNumber: 0 }
		);
	const project = createProjectObjectModel();
	readScope(readProjectSource(source).slice(1), { kind: 'root', project });
	return project;
}
