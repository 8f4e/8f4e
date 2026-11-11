import { parseLine as readLine, parseInstructionTokens as readTokens } from '../parseLine';
import { parseProjectConstantNamespacePassLine as readPass } from '../parseProjectConstantNamespacePassLine';
import { parseProjectMemoryInitializerLine as readInitializer } from '../parseProjectMemoryInitializerLine';
import { parseMemoryInstructionArgumentsShape as readMemoryShape } from './memoryInstructionParser';
import {
	parseArgument as readArgument,
	classifyIdentifier as readIdentifier,
	parseCompileTimeOperand as readOperand,
	decodeStringLiteral as readString,
} from './parseArgument';
import readConstantExpression from './parseConstantMulDivExpression';
import readLiteralExpression from './parseLiteralMulDivExpression';
import { type SyntaxErrorCodeValue, type SyntaxErrorLine, SyntaxIssue } from './syntaxError';

/** Pure syntax helpers return failure data; the source-owning caller constructs a diagnostic. */
export type SyntaxResult<T> =
	| { ok: true; value: T }
	| { ok: false; issue: { code: SyntaxErrorCodeValue; message: string; line?: SyntaxErrorLine } };

function capture<T>(operation: () => T): SyntaxResult<T> {
	try {
		return { ok: true, value: operation() };
	} catch (error) {
		if (!(error instanceof SyntaxIssue)) throw error;
		return {
			ok: false,
			issue: { code: error.code, message: error.message, ...(error.line ? { line: error.line } : {}) },
		};
	}
}

export const parseLine = (...args: Parameters<typeof readLine>) => capture(() => readLine(...args));
export const parseInstructionTokens = (...args: Parameters<typeof readTokens>) => capture(() => readTokens(...args));
export const parseProjectConstantNamespacePassLine = (...args: Parameters<typeof readPass>) =>
	capture(() => readPass(...args));
export const parseProjectMemoryInitializerLine = (...args: Parameters<typeof readInitializer>) =>
	capture(() => readInitializer(...args));
export const parseMemoryInstructionArgumentsShape = (...args: Parameters<typeof readMemoryShape>) =>
	capture(() => readMemoryShape(...args));
export const parseArgument = (...args: Parameters<typeof readArgument>) => capture(() => readArgument(...args));
export const classifyIdentifier = (...args: Parameters<typeof readIdentifier>) =>
	capture(() => readIdentifier(...args));
export const decodeStringLiteral = (...args: Parameters<typeof readString>) => capture(() => readString(...args));
export const parseCompileTimeOperand = (...args: Parameters<typeof readOperand>) => capture(() => readOperand(...args));
export const parseConstantMulDivExpression = (...args: Parameters<typeof readConstantExpression>) =>
	capture(() => readConstantExpression(...args));
export const parseLiteralMulDivExpression = (...args: Parameters<typeof readLiteralExpression>) =>
	capture(() => readLiteralExpression(...args));
