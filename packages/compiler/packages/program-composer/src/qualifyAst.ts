import type { Argument, ArgumentIdentifier, CompilerASTLine, ValidatedAST } from '@8f4e/language-spec';
import { ArgumentType, isBinaryCompileTimeExpression } from '@8f4e/language-spec';

function qualifySymbol(prefix: string, symbol: string): string {
	return `${prefix}${symbol}`;
}

function qualifyIntermoduleIdentifier(argument: ArgumentIdentifier, prefix: string): ArgumentIdentifier {
	if (argument.scope !== 'intermodule' || argument.targetModuleId === 'this') {
		return argument;
	}

	const targetModuleId = qualifySymbol(prefix, argument.targetModuleId);
	return {
		...argument,
		targetModuleId,
	};
}

function qualifyArgument(argument: Argument, prefix: string): Argument {
	if (argument.type === ArgumentType.IDENTIFIER) {
		return qualifyIntermoduleIdentifier(argument, prefix);
	}
	if (argument.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
		const left =
			argument.left.type === ArgumentType.IDENTIFIER
				? qualifyIntermoduleIdentifier(argument.left, prefix)
				: argument.left;
		if (!isBinaryCompileTimeExpression(argument)) {
			return { ...argument, left };
		}
		return {
			...argument,
			left,
			right:
				argument.right.type === ArgumentType.IDENTIFIER
					? qualifyIntermoduleIdentifier(argument.right, prefix)
					: argument.right,
		};
	}
	return argument;
}

const FIRST_ARGUMENT_SYMBOL_INSTRUCTIONS = new Set(['module', 'function', 'constants', 'call', 'use']);

function qualifyLine(line: CompilerASTLine, prefix: string): CompilerASTLine {
	const argumentsWithQualifiedModules = line.arguments.map(argument => qualifyArgument(argument, prefix));
	if (FIRST_ARGUMENT_SYMBOL_INSTRUCTIONS.has(line.instruction)) {
		const firstArgument = argumentsWithQualifiedModules[0] as ArgumentIdentifier;
		argumentsWithQualifiedModules[0] = {
			...firstArgument,
			value: qualifySymbol(prefix, firstArgument.value),
		};
	}

	return {
		...line,
		arguments: argumentsWithQualifiedModules,
	} as CompilerASTLine;
}

function rebasePairedBlockIndexes(line: CompilerASTLine, removedLineIndex: number | undefined): CompilerASTLine {
	if (removedLineIndex === undefined) {
		return line;
	}
	const rebase = (index: number) => (index > removedLineIndex ? index - 1 : index);
	if (line.instruction === 'if') {
		const ifBlock = line.ifBlock!;
		return { ...line, ifBlock: { ...ifBlock, matchingIfEndIndex: rebase(ifBlock.matchingIfEndIndex) } };
	}
	if (line.instruction === 'ifEnd') {
		const ifEndBlock = line.ifEndBlock!;
		return { ...line, ifEndBlock: { ...ifEndBlock, matchingIfIndex: rebase(ifEndBlock.matchingIfIndex) } };
	}
	if (line.instruction === 'block') {
		const blockBlock = line.blockBlock!;
		return {
			...line,
			blockBlock: { ...blockBlock, matchingBlockEndIndex: rebase(blockBlock.matchingBlockEndIndex) },
		};
	}
	if (line.instruction === 'blockEnd') {
		const blockEndBlock = line.blockEndBlock!;
		return {
			...line,
			blockEndBlock: { ...blockEndBlock, matchingBlockIndex: rebase(blockEndBlock.matchingBlockIndex) },
		};
	}
	return line;
}

/** Qualifies all project-unit-owned symbols and removes nested host exports from one validated AST. */
export function qualifyAst<TAst extends ValidatedAST>(ast: TAst, prefix: string): TAst {
	const removedLineIndex = ast.type === 'function' && ast.exportLine ? ast.lines.indexOf(ast.exportLine) : undefined;
	const qualifiedLineByOriginal = new Map<CompilerASTLine, CompilerASTLine>();
	const lines = ast.lines.flatMap((line, index) => {
		if (index === removedLineIndex) {
			return [];
		}
		const qualifiedLine = rebasePairedBlockIndexes(qualifyLine(line, prefix), removedLineIndex);
		qualifiedLineByOriginal.set(line, qualifiedLine);
		return [qualifiedLine];
	});
	const getQualifiedLine = <TLine extends CompilerASTLine>(line: TLine): TLine =>
		qualifiedLineByOriginal.get(line) as TLine;

	switch (ast.type) {
		case 'module':
			return {
				...ast,
				id: qualifySymbol(prefix, ast.id),
				lines,
				moduleLine: getQualifiedLine(ast.moduleLine),
			} as TAst;
		case 'constants':
			return {
				...ast,
				id: qualifySymbol(prefix, ast.id),
				lines,
				constantsLine: getQualifiedLine(ast.constantsLine),
			} as TAst;
		case 'function':
			return {
				...ast,
				name: qualifySymbol(prefix, ast.name),
				lines,
				functionLine: getQualifiedLine(ast.functionLine),
				functionEndLine: getQualifiedLine(ast.functionEndLine),
				exportLine: undefined,
				...(ast.importLine ? { importLine: getQualifiedLine(ast.importLine) } : {}),
			} as TAst;
	}
}
