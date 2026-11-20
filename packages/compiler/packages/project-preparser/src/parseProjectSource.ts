import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import type { DocumentBlockType, ProjectBlock, ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import {
	createProjectObjectModel,
	documentBlockInstructionByType,
	documentBlockInstructionPairs,
	projectInstructions,
} from '@8f4e/language-spec';
import { classifyProjectScopeLine, SyntaxErrorCode } from '@8f4e/tokenizer';
import { FORMAT_HEADER } from './delimiters';
import { getEntryName } from './projectLines';
import { parseProjectMemoryExposureLine } from './projectMemoryExposure';
import {
	isBlock,
	readProjectSource,
	type SourceBlock,
	type SourceGroupBlock,
	type SourceLine,
	type SourceNode,
	sourceLines,
} from './projectSource';
import { expandProjectTemplateNodes } from './projectTemplates';

type ScopeContext =
	| { kind: 'root'; project: ProjectObjectModel }
	| { kind: 'group'; project: ProjectGroupObjectModel }
	| { kind: 'entry'; project: ProjectObjectModel; name: string };

/** Block ids remain unique expanded-source positions; source spans keep original document rows for errors. */
type ExpandedSourcePosition = { nextLineNumber: number };

function hasDisabledDirective(code: readonly string[]): boolean {
	return code.some(line => /^\s*;\s*@disabled(?:\s|$)/.test(line));
}

function addBlock(
	target: ProjectObjectModel,
	node: SourceBlock,
	type: DocumentBlockType,
	id: number,
	position: ExpandedSourcePosition,
	entry?: string
): void {
	const code = sourceLines([node]);
	position.nextLineNumber += code.length - 2;
	const block: ProjectBlock = {
		id,
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
			includes: target.includes,
			note: target.notes,
		};
		collections[type].push(block);
	}
}

function readGroup(
	node: SourceGroupBlock,
	entry: string,
	id: number,
	position: ExpandedSourcePosition
): ProjectGroupObjectModel {
	const group: ProjectGroupObjectModel = {
		...createProjectObjectModel(),
		type: 'group',
		id,
		name: node.header.name,
		entry,
		code: [node.start.text],
		exposures: [],
	};
	readScope(node.children, { kind: 'group', project: group }, position);
	group.code.push(node.end.text);
	return group;
}

function readScopeLine(node: SourceLine, context: ScopeContext, pendingGapLines: string[]): void {
	const line = node.text;
	const trimmed = line.trim();
	const { project } = context;
	if (context.kind === 'group') {
		if (node.declaration === 'expose') {
			const exposure = {
				...parseProjectMemoryExposureLine(trimmed, node.lineNumber),
				lineNumber: project.code.length,
			};
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
	const scopeLine = classifyProjectScopeLine(line);
	if (scopeLine.kind === 'gap') {
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
	if (scopeLine.kind !== 'declaration' || scopeLine.instruction === 'expose')
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

function readScopeBlock(node: SourceBlock, context: ScopeContext, id: number, position: ExpandedSourcePosition): void {
	const { project } = context;
	if (node.opener === 'entry') {
		if (context.kind === 'entry')
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Parse error at line ${node.start.lineNumber}: entry blocks cannot be nested inside entries`,
				{ kind: 'document' },
				{ lineNumber: node.start.lineNumber - 1 }
			);
		const name = getEntryName(node.start.text, node.start.lineNumber);
		if (!project.entries.includes(name)) project.entries.push(name);
		readScope(node.children, { kind: 'entry', project, name }, position);
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
		const group = readGroup(node, context.name, id, position);
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
	addBlock(project, node, type, id, position, entry);
}

function readScope(nodes: SourceNode[], context: ScopeContext, position: ExpandedSourcePosition): void {
	const pendingGapLines: string[] = [];
	for (const node of nodes) {
		if (isBlock(node)) {
			pendingGapLines.length = 0;
			const id = position.nextLineNumber++;
			readScopeBlock(node, context, id, position);
			position.nextLineNumber++;
		} else {
			position.nextLineNumber++;
			readScopeLine(node, context, pendingGapLines);
		}
	}
	if (context.kind === 'root' && context.project.code.length) context.project.code.push(...pendingGapLines);
}

/** Parses `.8f4e` text into the canonical compiler-owned project object model. */
export function parseProjectSource(text: string): ProjectObjectModel {
	const header = text.split('\n', 1)[0].trim();
	if (header !== FORMAT_HEADER)
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Invalid .8f4e file: expected header "${FORMAT_HEADER}", got "${header}"`,
			{ kind: 'document' },
			{ lineNumber: 0 }
		);
	const project = createProjectObjectModel();
	const nodes = readProjectSource(text, [projectInstructions.template]).slice(1);
	readScope(expandProjectTemplateNodes(nodes), { kind: 'root', project }, { nextLineNumber: 2 });
	return project;
}
