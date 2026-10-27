import {
	ArgumentType,
	type CompilerASTLine,
	type CompileTimeOperand,
	isArrayMemoryDeclarationLine,
	isScalarMemoryDeclarationLine,
} from '@8f4e/language-spec';
import { parseInstructionTokens, parseLine, SyntaxRulesError } from '@8f4e/tokenizer';

function parseSourceLine(line: string, lineNumber: number): CompilerASTLine | undefined {
	try {
		return parseLine(line, lineNumber);
	} catch (error) {
		if (error instanceof SyntaxRulesError) return undefined;
		throw error;
	}
}

function splitComment(line: string): { body: string; comment?: string } {
	let isString = false;
	let isEscaped = false;

	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		if (isEscaped) {
			isEscaped = false;
			continue;
		}
		if (char === '\\' && isString) {
			isEscaped = true;
			continue;
		}
		if (char === '"') {
			isString = !isString;
			continue;
		}
		if (char === ';' && !isString) {
			return {
				body: line.slice(0, index),
				comment: line.slice(index + 1),
			};
		}
	}

	return { body: line };
}

function getMemoryDefaultArgumentStartIndex(parsedLine: CompilerASTLine): number | undefined {
	if (isArrayMemoryDeclarationLine(parsedLine)) {
		return 2;
	}

	if (!isScalarMemoryDeclarationLine(parsedLine)) {
		return undefined;
	}

	const [firstArg] = parsedLine.arguments;
	return firstArg?.type === ArgumentType.IDENTIFIER && firstArg.referenceKind === 'plain' ? 1 : undefined;
}

function isIntermodularOperand(operand: CompileTimeOperand): boolean {
	return operand.type === ArgumentType.IDENTIFIER && operand.scope === 'intermodule';
}

function isIntermodularMemorySourceArgument(argument: CompilerASTLine['arguments'][number]): boolean {
	if (argument.type === ArgumentType.IDENTIFIER) {
		return argument.scope === 'intermodule';
	}

	return (
		argument.type === ArgumentType.COMPILE_TIME_EXPRESSION &&
		(isIntermodularOperand(argument.left) || (argument.right !== undefined && isIntermodularOperand(argument.right)))
	);
}

function removeIntermodularMemoryConnectionsFromLine(line: string, lineNumber: number): string | undefined {
	const parsedLine = parseSourceLine(line, lineNumber);
	if (!parsedLine) {
		return undefined;
	}

	const defaultArgumentStartIndex = getMemoryDefaultArgumentStartIndex(parsedLine);
	if (defaultArgumentStartIndex === undefined) {
		return undefined;
	}

	const removedTokenIndexes = new Set<number>();
	for (let argumentIndex = defaultArgumentStartIndex; argumentIndex < parsedLine.arguments.length; argumentIndex++) {
		if (isIntermodularMemorySourceArgument(parsedLine.arguments[argumentIndex])) {
			removedTokenIndexes.add(argumentIndex + 1);
		}
	}

	if (removedTokenIndexes.size === 0) {
		return undefined;
	}

	const { body, comment } = splitComment(line);
	const leadingWhitespace = body.match(/^\s*/)?.[0] ?? '';
	const keptTokens = parseInstructionTokens(body, lineNumber).filter(
		(_token, tokenIndex) => !removedTokenIndexes.has(tokenIndex)
	);
	const updatedLine = `${leadingWhitespace}${keptTokens.join(' ')}`;

	return comment !== undefined ? `${updatedLine} ;${comment}` : updatedLine;
}

export function removeIntermodularMemoryConnectionsFromCode(code: string[]): string[] | undefined {
	let didUpdate = false;
	const updatedCode = code.map((line, index) => {
		const updatedLine = removeIntermodularMemoryConnectionsFromLine(line, index + 1);
		if (updatedLine === undefined) {
			return line;
		}

		didUpdate = true;
		return updatedLine;
	});

	return didUpdate ? updatedCode : undefined;
}

export function hasIntermodularMemoryConnections(code: string[]): boolean {
	return removeIntermodularMemoryConnectionsFromCode(code) !== undefined;
}
