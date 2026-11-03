import type { CompilerASTLine } from '@8f4e/language-spec';
import { ArgumentType, isSemanticInstructionLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { parseLine } from './parseLine';
import { classifyIdentifier } from './syntax/parseArgument';
import { SyntaxErrorCode, SyntaxRulesError } from './syntax/syntaxError';

describe('parseLine', () => {
	const fixtures: [number, string, CompilerASTLine][] = [
		[
			1,
			'int alpha 1',
			{
				arguments: [
					classifyIdentifier('alpha'),
					{
						type: ArgumentType.LITERAL,
						value: 1,
						isInteger: true,
					},
				],
				instruction: 'int',
				lineNumber: 1,
			},
		],
		[
			100,
			'push 0xff',
			{
				arguments: [
					{
						type: ArgumentType.LITERAL,
						value: 255,
						isInteger: true,
						isHex: true,
					},
				],
				instruction: 'push',
				lineNumber: 100,
			},
		],
	];

	it.each(fixtures)('parses line %p as AST', (lineNumber, line, ast) => {
		expect(parseLine(line, lineNumber)).toStrictEqual(ast);
	});

	it('narrows semantic instructions in generated AST lines', () => {
		expect(isSemanticInstructionLine(parseLine('const SIZE 16', 0))).toBe(true);
		expect(isSemanticInstructionLine(parseLine('use math', 0))).toBe(true);
		expect(isSemanticInstructionLine(parseLine('module demo', 0))).toBe(true);
	});

	it('does not narrow runtime/codegen instructions as semantic instructions', () => {
		expect(isSemanticInstructionLine(parseLine('push 1', 0))).toBe(false);
		expect(isSemanticInstructionLine(parseLine('int value 1', 0))).toBe(false);
	});

	it('rejects wrong arity and raw argument shape in tokenizer', () => {
		expect(() => parseLine('push', 0)).toThrowError(SyntaxRulesError);
		expect(() => parseLine('mapBegin bool', 0)).toThrowError(SyntaxRulesError);
		expect(() => parseLine('storeBytes -1', 0)).toThrowError(SyntaxRulesError);
		expect(() => parseLine('map "AB" 1', 0)).toThrowError(SyntaxRulesError);
	});

	it('rejects unknown instruction names in tokenizer', () => {
		expect(() => parseLine('constructor', 0)).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION })
		);
		expect(() => parseLine('pass SIZE', 0)).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION })
		);
	});

	it('preserves arithmetic-looking quoted strings as string arguments', () => {
		const result = parseLine('push "2*3.0"', 0);
		expect(result.instruction).toBe('push');
		expect(result.arguments).toEqual([{ type: ArgumentType.STRING_LITERAL, value: '2*3.0' }]);
	});

	it('reports malformed string escapes as INVALID_STRING_LITERAL', () => {
		try {
			parseLine('push "\\z"', 0);
			throw new Error('Expected parseLine to reject the malformed escape');
		} catch (error) {
			expect(error).toBeInstanceOf(SyntaxRulesError);
			expect((error as SyntaxRulesError).code).toBe(SyntaxErrorCode.INVALID_STRING_LITERAL);
		}
	});

	it('parses a quoted string argument as STRING_LITERAL', () => {
		const result = parseLine('push "hello"', 0);
		expect(result.instruction).toBe('push');
		expect(result.arguments).toEqual([{ type: ArgumentType.STRING_LITERAL, value: 'hello' }]);
	});

	it('parses inline call arguments', () => {
		const result = parseLine('call foo 2 1.3', 0);
		expect(result).toEqual({
			lineNumber: 0,
			instruction: 'call',
			arguments: [
				classifyIdentifier('foo'),
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 1.3, isInteger: false },
			],
		});
	});

	it('parses a quoted string with spaces as a single argument', () => {
		const result = parseLine('push "hello world"', 0);
		expect(result.arguments).toHaveLength(1);
		expect(result.arguments[0]).toEqual({ type: ArgumentType.STRING_LITERAL, value: 'hello world' });
	});

	it('preserves a quoted semicolon inside a string', () => {
		const result = parseLine('push "a;b"', 0);
		expect(result.arguments).toEqual([{ type: ArgumentType.STRING_LITERAL, value: 'a;b' }]);
	});

	it('handles escape sequences inside a quoted string', () => {
		const result = parseLine('push "a\\nb"', 0);
		expect(result.arguments).toEqual([{ type: ArgumentType.STRING_LITERAL, value: 'a\nb' }]);
	});

	it('throws on unterminated string literal', () => {
		expect(() => parseLine('push "hello', 0)).toThrow('Unterminated string literal');
	});

	it('adds line metadata to parse-time syntax errors', () => {
		try {
			parseLine('push 1e309', 12);
			throw new Error('Expected parseLine to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(SyntaxRulesError);
			expect((error as SyntaxRulesError).code).toBe(SyntaxErrorCode.INVALID_NUMERIC_LITERAL);
			expect((error as SyntaxRulesError).line).toEqual(
				expect.objectContaining({
					lineNumber: 12,
					instruction: 'push',
				})
			);
		}
	});

	it('exposes instruction in line metadata for argument-level errors', () => {
		let thrownError: SyntaxRulesError | undefined;
		try {
			parseLine('push', 8);
		} catch (error) {
			thrownError = error as SyntaxRulesError;
		}
		expect(thrownError).toBeInstanceOf(SyntaxRulesError);
		expect(thrownError?.line?.lineNumber).toBe(8);
		expect(thrownError?.line?.instruction).toBe('push');
	});

	it('parses array declarations with more than seven initializer values', () => {
		const result = parseLine('int[] notes 12 48 50 53 55 57 60 62 64', 0);

		expect(result.instruction).toBe('int[]');
		expect(result.arguments).toHaveLength(10);
		expect(result.arguments.slice(2)).toEqual([
			{ type: ArgumentType.LITERAL, value: 48, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 50, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 53, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 55, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 57, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 60, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 62, isInteger: true },
			{ type: ArgumentType.LITERAL, value: 64, isInteger: true },
		]);
	});

	it.each(['branch', 'branchIfTrue'] as const)(
		'accepts non-negative decimal, hex, and binary integer literals for %s and rejects negative or floating-point literals with source-line metadata',
		instruction => {
			expect(parseLine(`${instruction} 0`, 3).arguments).toEqual([
				{ type: ArgumentType.LITERAL, value: 0, isInteger: true },
			]);
			expect(parseLine(`${instruction} 2`, 4).arguments).toEqual([
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
			]);
			expect(parseLine(`${instruction} 0x2`, 5).arguments).toEqual([
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true, isHex: true },
			]);
			expect(parseLine(`${instruction} 0b10`, 6).arguments).toEqual([
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
			]);

			for (const badLiteral of ['-1', '0.5', '1.0', '1f64']) {
				let thrownError: SyntaxRulesError | undefined;
				try {
					parseLine(`${instruction} ${badLiteral}`, 14);
				} catch (error) {
					thrownError = error as SyntaxRulesError;
				}
				expect(thrownError).toBeInstanceOf(SyntaxRulesError);
				expect(thrownError?.code).toBe(SyntaxErrorCode.INVALID_ARGUMENT);
				expect(thrownError?.line).toEqual(
					expect.objectContaining({
						lineNumber: 14,
						instruction,
					})
				);
			}
		}
	);
});
