import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import type { DiagnosticSource, projectInstructions } from '@8f4e/language-spec';
import {
	classifyProjectScopeLine,
	type ProjectScopeDeclarationName,
	SyntaxErrorCode,
	syntaxErrorMessage,
} from '@8f4e/tokenizer';
import { ENTRY_BLOCK_DELIMITER, GROUP_BLOCK_DELIMITER } from './delimiters';
import {
	getExpectedProjectCloserPrefix,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
	type ProjectBlockOpener,
	startsWithInstruction,
} from './projectKeywords';
import { type GroupHeader, parseGroupHeader } from './projectLines';

/** Private source spans, discarded before constructing the canonical project model. */
export interface SourceLine {
	text: string;
	lineNumber: number;
	/** Present only on classified group-body declarations. */
	declaration?: ProjectScopeDeclarationName;
}
interface SourceBlockSpan {
	start: SourceLine;
	end: SourceLine;
	children: SourceNode[];
}
type ScopeDelimiter = typeof projectInstructions.template;
type SourceBlockOpener = ProjectBlockOpener | ScopeDelimiter['opener'];

export interface SourceGroupBlock extends SourceBlockSpan {
	opener: 'group';
	header: GroupHeader;
}
export type SourceBlock = SourceGroupBlock | (SourceBlockSpan & { opener: Exclude<SourceBlockOpener, 'group'> });
export type SourceNode = SourceLine | SourceBlock;

export function isBlock(node: SourceNode): node is SourceBlock {
	return 'opener' in node;
}

export function instruction(line: SourceLine): string {
	return line.text.split(';', 1)[0].trim();
}

export function syntaxError(
	code: Parameters<typeof syntaxErrorMessage>[0],
	line: SourceLine,
	message?: string,
	owner?: SourceLine
): never {
	throw syntaxErrorAt(
		code,
		message ?? syntaxErrorMessage(code),
		owner ? { kind: 'block', projectBlockId: owner.lineNumber, projectGroupPath: '' } : { kind: 'document' },
		{
			lineNumber: line.lineNumber - (owner?.lineNumber ?? 1),
			instruction: instruction(line).split(/\s+/)[0],
		}
	);
}

class ProjectSourceReader {
	readonly lines: SourceLine[];
	position = 0;
	private readonly scopeClosers: Map<string, string>;

	constructor(
		code: readonly string[],
		private readonly additionalScopes: readonly ScopeDelimiter[] = [],
		private readonly diagnosticSource?: DiagnosticSource
	) {
		this.lines = code.map((text, index) => ({ text, lineNumber: index + 1 }));
		this.scopeClosers = new Map(
			[ENTRY_BLOCK_DELIMITER, GROUP_BLOCK_DELIMITER, ...additionalScopes].map(({ opener, closer }) => [opener, closer])
		);
	}

	private opener(line: SourceLine): SourceBlockOpener | null {
		return (
			this.additionalScopes.find(({ opener }) => startsWithInstruction(instruction(line), opener))?.opener ??
			getProjectOpenerKeyword(line.text.trim())
		);
	}

	private closer(line: SourceLine): string | null {
		return (
			this.additionalScopes.find(({ closer }) => startsWithInstruction(instruction(line), closer))?.closer ??
			getProjectCloserKeyword(line.text.trim())
		);
	}

	private fail(line: SourceLine, message: string, owner?: SourceLine): never {
		return this.syntaxError(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			line,
			`Parse error at line ${line.lineNumber}: ${message}`,
			owner
		);
	}

	private syntaxError(
		code: Parameters<typeof syntaxErrorMessage>[0],
		line: SourceLine,
		message?: string,
		owner?: SourceLine
	): never {
		if (this.diagnosticSource) {
			throw syntaxErrorAt(code, message ?? syntaxErrorMessage(code), this.diagnosticSource, {
				lineNumber: line.lineNumber - 1,
				instruction: instruction(line).split(/\s+/)[0],
			});
		}
		return syntaxError(code, line, message, owner);
	}

	readScope(expectedCloser?: string, owner?: SourceLine, flatBlockOpener?: SourceBlockOpener): SourceNode[] {
		const result: SourceNode[] = [];
		while (this.position < this.lines.length) {
			const line = this.lines[this.position];
			const closer = this.closer(line);
			if (closer) {
				if (closer !== expectedCloser) this.fail(line, `unexpected closer "${closer}"`, owner);
				return result;
			}
			if (this.opener(line)) {
				if (flatBlockOpener)
					this.fail(
						line,
						`mixed block type markers (found opener "${line.text.trim()}" inside "${flatBlockOpener}" block)`,
						owner
					);
				result.push(this.readBlock());
			} else {
				if (expectedCloser === GROUP_BLOCK_DELIMITER.closer) {
					const scopeLine = classifyProjectScopeLine(line.text);
					if (scopeLine.kind !== 'gap' && scopeLine.kind !== 'declaration')
						this.syntaxError(
							SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
							line,
							`Parse error at line ${line.lineNumber}: instruction "${scopeLine.instruction}" is not allowed in a group body`
						);
					if (scopeLine.kind === 'declaration') line.declaration = scopeLine.instruction;
				}
				result.push(line);
				this.position++;
			}
		}
		return result;
	}

	readBlock(mode: 'nested' | 'flat' = 'nested'): SourceBlock {
		const start = this.lines[this.position++];
		const opener = this.opener(start)!;
		const scopeCloser = this.scopeClosers.get(opener);
		const expectedCloser = scopeCloser ?? getExpectedProjectCloserPrefix(opener);
		const children: SourceNode[] = [];
		if (scopeCloser) children.push(...this.readScope(scopeCloser, start, mode === 'flat' ? opener : undefined));
		else {
			while (this.position < this.lines.length) {
				const line = this.lines[this.position];
				const closer = this.closer(line);
				if (opener === 'note' && closer !== expectedCloser) {
					children.push(line);
					this.position++;
					continue;
				}
				if (
					this.additionalScopes.some(
						pair =>
							startsWithInstruction(instruction(line), pair.opener) ||
							startsWithInstruction(instruction(line), pair.closer)
					)
				) {
					this.syntaxError(SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK, line, undefined, start);
				}
				if (closer) {
					if (closer !== expectedCloser) this.fail(line, `closer "${closer}" does not match opener "${opener}"`, start);
					break;
				}
				if (this.opener(line))
					this.fail(
						line,
						`mixed block type markers (found opener "${line.text.trim()}" inside "${opener}" block)`,
						start
					);
				children.push(line);
				this.position++;
			}
		}
		const end = this.lines[this.position++];
		if (!end)
			this.syntaxError(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				start,
				`Parse error: unclosed block with ${scopeCloser ? `closer "${scopeCloser}"` : `opener "${opener}"`}`,
				start
			);
		if (this.additionalScopes.some(pair => pair.opener === opener) && instruction(end) !== expectedCloser)
			this.syntaxError(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, end, undefined, start);
		const span = { start, children, end };
		return opener === 'group'
			? { ...span, opener, header: parseGroupHeader(start.text, start.lineNumber, this.diagnosticSource) }
			: { ...span, opener };
	}
}

/** Read structural boundaries while keeping document blocks, especially notes, opaque. */
export function readProjectSource(
	source: string,
	additionalScopes: readonly ScopeDelimiter[] = [],
	diagnosticSource?: DiagnosticSource
): SourceNode[] {
	return new ProjectSourceReader(source.split('\n'), additionalScopes, diagnosticSource).readScope();
}

export function sourceLines(nodes: SourceNode[]): string[] {
	return nodes.flatMap(node =>
		isBlock(node) ? [node.start.text, ...sourceLines(node.children), node.end.text] : [node.text]
	);
}

interface BlockValidationContext {
	diagnosticSource?: DiagnosticSource;
	blockIndex?: number;
	expectedOpener?: ProjectBlockOpener;
}

interface ClassifiedGroupDeclaration {
	instruction: ProjectScopeDeclarationName;
	/** Zero-based row in the original flat group wrapper. */
	lineNumber: number;
}

/**
 * Validate a flat model-owned block or group shell. Child blocks are owned separately.
 * Return the classified group declarations in source order; other block types return an empty list.
 */
export function validateProjectCodeBlock(
	code: readonly string[],
	{ diagnosticSource = { kind: 'document' }, blockIndex, expectedOpener }: BlockValidationContext = {}
): ClassifiedGroupDeclaration[] {
	const description = blockIndex === undefined ? 'Block' : `Block ${blockIndex}`;
	function fail(lineNumber: number, message: string, instruction?: string): never {
		throw syntaxErrorAt(SyntaxErrorCode.INVALID_BLOCK_STRUCTURE, `${description}: ${message}`, diagnosticSource, {
			lineNumber,
			instruction,
		});
	}
	const first = code.findIndex(line => line.trim() !== '');
	if (first < 0) fail(0, 'block has no content');
	const opener = getProjectOpenerKeyword(code[first].trim());
	if (!opener) fail(first, `unknown or missing opener "${code[first].trim()}"`);
	if (expectedOpener && opener !== expectedOpener)
		fail(first, `expected opener "${expectedOpener}", got "${opener}"`, opener);
	let last = code.length - 1;
	while (code[last].trim() === '') last--;
	const closer = getProjectCloserKeyword(code[last].trim());
	if (!closer) fail(last, `unknown or missing closer "${code[last].trim()}"`);
	if (closer !== getExpectedProjectCloserPrefix(opener))
		fail(last, `opener/closer mismatch (opener "${opener}", closer "${code[last].trim()}")`, closer);
	const reader = new ProjectSourceReader(code, [], diagnosticSource);
	reader.position = first;
	const block = reader.readBlock('flat');
	if (reader.position !== last + 1)
		fail(block.end.lineNumber - 1, `closer "${block.end.text.trim()}" is not at the end of the block`, closer);
	return block.opener === 'group'
		? block.children.flatMap(line =>
				!isBlock(line) && line.declaration ? [{ instruction: line.declaration, lineNumber: line.lineNumber - 1 }] : []
			)
		: [];
}
