import { getError } from '@8f4e/compiler-diagnostics';
import { ErrorCode, isValidModuleName, projectInstructions } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { mapSourceScope } from './mapSourceScope';
import { startsWithInstruction } from './projectKeywords';
import { isProjectGapLine } from './projectLines';
import {
	instruction,
	isBlock,
	readProjectSource,
	type SourceBlock,
	type SourceLine,
	type SourceNode,
	sourceLines,
	syntaxError,
} from './projectSource';

function namedInstruction(line: SourceLine): string {
	const [, name, ...extra] = instruction(line).split(/\s+/);
	if (!name || extra.length || !isValidModuleName(name)) syntaxError(SyntaxErrorCode.INVALID_TEMPLATE_NAME, line);
	return name;
}

function references(group: SourceBlock): SourceLine[] {
	return group.children.filter(
		(node): node is SourceLine => !isBlock(node) && startsWithInstruction(instruction(node), 'useTemplate')
	);
}

function templateError(
	code: typeof ErrorCode.UNDEFINED_TEMPLATE | typeof ErrorCode.DUPLICATE_TEMPLATE | typeof ErrorCode.RECURSIVE_TEMPLATE,
	line: SourceLine,
	name: string
): never {
	const diagnostic = getError(
		code,
		{
			diagnosticSource: { kind: 'document' },
			lineNumber: line.lineNumber - 1,
			instruction: instruction(line).split(/\s+/)[0],
		},
		undefined,
		{
			identifier: name,
		}
	);
	throw diagnostic;
}

/** Expand scope-local templates in raw source, retaining useTemplate as an ordinary group source line. */
export function inlineProjectTemplates(source: string): string {
	if (!/^\s*(?:template|templateEnd|useTemplate)(?=[\s;]|$)/m.test(source)) return source;
	function expandScope(nodes: SourceNode[], active: string[] = []): SourceNode[] {
		const templates = new Map<string, SourceBlock>();
		for (const node of nodes) {
			if (!isBlock(node) || node.opener !== 'template') continue;
			const name = namedInstruction(node.start);
			if (templates.has(name)) templateError(ErrorCode.DUPLICATE_TEMPLATE, node.start, name);
			for (const child of node.children) {
				if (!isBlock(child) && !isProjectGapLine(child.text.trim()))
					syntaxError(SyntaxErrorCode.INVALID_TEMPLATE_CONTENT, child);
			}
			templates.set(name, node);
		}
		function expandGroup(group: SourceBlock): SourceBlock {
			const uses = references(group);
			if (uses.length > 1) syntaxError(SyntaxErrorCode.MULTIPLE_TEMPLATE_REFERENCES, uses[1]);
			const [use] = uses;
			if (!use) return { ...group, children: expandScope(group.children, active) };
			const name = namedInstruction(use);
			if (group.children.some(isBlock)) syntaxError(SyntaxErrorCode.TEMPLATE_INSTANCE_HAS_CONTENT, use);
			const template = templates.get(name);
			if (!template)
				templateError(active.includes(name) ? ErrorCode.RECURSIVE_TEMPLATE : ErrorCode.UNDEFINED_TEMPLATE, use, name);
			// Template gaps belong to the definition, not each instance's editable outer shell.
			const shared = expandScope(template.children, [...active, name]).filter(isBlock);
			return { ...group, children: [...group.children, ...shared] };
		}

		return mapSourceScope(nodes, (node, context) => {
			if (!isBlock(node)) {
				if (startsWithInstruction(instruction(node), 'useTemplate'))
					syntaxError(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, node);
				return [node];
			}
			if (node.opener === 'template') {
				if (context === 'entry') syntaxError(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, node.start);
				return [];
			}
			if (node.opener === 'group') return [expandGroup(node)];
			if (node.opener !== 'note') {
				for (const line of node.children) {
					if (!isBlock(line) && /^(?:template|templateEnd|useTemplate)(?:\s|$)/.test(instruction(line)))
						syntaxError(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, line);
				}
			}
			return [node];
		});
	}
	return sourceLines(expandScope(readProjectSource(source, [projectInstructions.template]))).join('\n');
}

/** Collapse expanded groups in serialization order. The last reference in each owning scope supplies its body. */
export function extractProjectTemplates(source: string): string {
	if (!/^\s*(?:template|useTemplate)(?=[\s;]|$)/m.test(source)) return source;
	function extractScope(nodes: SourceNode[]): SourceNode[] {
		const templates = new Map<string, SourceBlock>();
		function extractGroup(group: SourceBlock): SourceBlock {
			const [use] = references(group);
			if (!use) return { ...group, children: extractScope(group.children) };
			const name = namedInstruction(use);
			templates.set(name, {
				opener: 'template',
				start: { ...use, text: `template ${name}` },
				end: { ...group.end, text: 'templateEnd' },
				children: group.children.filter(isBlock),
			});
			return { ...group, children: group.children.filter(child => !isBlock(child)) };
		}

		const result = mapSourceScope(nodes, node => {
			if (isBlock(node) && node.opener === 'template') return [];
			return [isBlock(node) && node.opener === 'group' ? extractGroup(node) : node];
		});
		const definitions = [...templates.values()].map(template => ({
			...template,
			children: extractScope(template.children),
		}));
		const firstBlock = result.findIndex(isBlock);
		result.splice(firstBlock < 0 ? result.length : firstBlock, 0, ...definitions);
		return result;
	}
	return sourceLines(extractScope(readProjectSource(source, [projectInstructions.template]))).join('\n');
}
