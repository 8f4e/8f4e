import { SyntaxErrorCode, SyntaxRulesError } from '@8f4e/tokenizer';
import {
	getExpectedProjectCloserPrefix,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
	startsWithInstruction,
} from './projectKeywords';

/** Private source spans, discarded before constructing the canonical project model. */
export interface SourceLine {
	text: string;
	lineNumber: number;
}
export interface SourceBlock {
	opener: string;
	start: SourceLine;
	end: SourceLine;
	children: SourceNode[];
}
export type SourceNode = SourceLine | SourceBlock;

export function isBlock(node: SourceNode): node is SourceBlock {
	return 'opener' in node;
}

export function instruction(line: SourceLine): string {
	return line.text.split(';', 1)[0].trim();
}

export function syntaxError(code: ConstructorParameters<typeof SyntaxRulesError>[0], line: SourceLine): never {
	throw new SyntaxRulesError(code, undefined, {
		lineNumber: line.lineNumber - 1,
		instruction: instruction(line).split(/\s+/)[0],
	});
}

/** Recognize project structure, keeping compiler blocks (especially note text) opaque. */
export function readTemplateSource(source: string): SourceNode[] {
	const lines = source.split('\n').map((text, index) => ({ text, lineNumber: index + 1 }));
	let index = 0;
	function read(expectedCloser?: string): SourceNode[] {
		const result: SourceNode[] = [];
		while (index < lines.length) {
			const start = lines[index];
			const trimmed = start.text.trim();
			const closer = startsWithInstruction(instruction(start), 'templateEnd')
				? 'templateEnd'
				: getProjectCloserKeyword(trimmed);
			if (closer) {
				if (closer !== expectedCloser) syntaxError(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, start);
				return result;
			}
			const opener = startsWithInstruction(instruction(start), 'template')
				? 'template'
				: getProjectOpenerKeyword(trimmed);
			if (!opener) {
				result.push(start);
				index++;
				continue;
			}
			const endKeyword = getExpectedProjectCloserPrefix(opener);
			index++;
			let children: SourceNode[];
			if (opener === 'group' || opener === 'entry' || opener === 'template') {
				children = read(endKeyword);
			} else {
				children = [];
				while (index < lines.length && !startsWithInstruction(lines[index].text.trim(), endKeyword)) {
					const line = lines[index++];
					if (opener !== 'note' && /^(?:template|templateEnd|useTemplate)(?:\s|$)/.test(instruction(line))) {
						syntaxError(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, line);
					}
					children.push(line);
				}
			}
			const end = lines[index];
			if (!end) syntaxError(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, start);
			if (opener === 'template' && instruction(end) !== 'templateEnd')
				syntaxError(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, end);
			result.push({ opener, start, children, end });
			index++;
		}
		if (expectedCloser) syntaxError(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, lines.at(-1)!);
		return result;
	}
	return read();
}

export function sourceLines(nodes: SourceNode[]): string[] {
	return nodes.flatMap(node =>
		isBlock(node) ? [node.start.text, ...sourceLines(node.children), node.end.text] : [node.text]
	);
}
