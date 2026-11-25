import { getError } from '@8f4e/compiler-diagnostics';
import { ErrorCode, isValidModuleName, projectInstructions } from '@8f4e/language-spec';
import { isProjectGapLine, SyntaxErrorCode } from '@8f4e/tokenizer';
import { mapSourceScope } from './mapSourceScope';
import {
	instruction,
	isBlock,
	readProjectSource,
	type SourceBlock,
	type SourceGroupBlock,
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
		{
			details: {
				identifier: name,
			},
		}
	);
	throw diagnostic;
}

/** Expand scope-local templates on the structural source tree, retaining original source spans and headers. */
export function expandProjectTemplateNodes(nodes: SourceNode[]): SourceNode[] {
	function expandScope(nodes: SourceNode[], active: string[] = []): SourceNode[] {
		const templates = new Map<string, SourceBlock>();
		for (const node of nodes) {
			if (!isBlock(node) || node.opener !== 'template') continue;
			const name = namedInstruction(node.start);
			if (templates.has(name)) templateError(ErrorCode.DUPLICATE_TEMPLATE, node.start, name);
			for (const child of node.children) {
				if (!isBlock(child) && !isProjectGapLine(child.text))
					syntaxError(SyntaxErrorCode.INVALID_TEMPLATE_CONTENT, child);
			}
			templates.set(name, node);
		}
		function expandGroup(group: SourceGroupBlock): SourceGroupBlock {
			const { template: name } = group.header;
			if (!name) return { ...group, children: expandScope(group.children, active) };
			if (group.children.some(isBlock)) syntaxError(SyntaxErrorCode.TEMPLATE_INSTANCE_HAS_CONTENT, group.start);
			const template = templates.get(name);
			if (!template)
				templateError(
					active.includes(name) ? ErrorCode.RECURSIVE_TEMPLATE : ErrorCode.UNDEFINED_TEMPLATE,
					group.start,
					name
				);
			// Template gaps belong to the definition, not each instance's editable outer shell.
			const shared = expandScope(template.children, [...active, name]).filter(isBlock);
			return { ...group, children: [...group.children, ...shared] };
		}

		return mapSourceScope(nodes, (node, context) => {
			if (!isBlock(node)) return [node];
			if (node.opener === 'template') {
				if (context === 'entry') syntaxError(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, node.start);
				return [];
			}
			if (node.opener === 'group') return [expandGroup(node)];
			return [node];
		});
	}
	return expandScope(nodes);
}

/** Collapse expanded groups in serialization order. The last reference in each owning scope supplies its body. */
export function extractProjectTemplates(source: string): string {
	function extractScope(nodes: SourceNode[]): SourceNode[] {
		const templates = new Map<string, SourceBlock>();
		function extractGroup(group: SourceGroupBlock): SourceGroupBlock {
			const { template: name } = group.header;
			if (!name) return { ...group, children: extractScope(group.children) };
			templates.set(name, {
				opener: 'template',
				start: { ...group.start, text: `template ${name}` },
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
