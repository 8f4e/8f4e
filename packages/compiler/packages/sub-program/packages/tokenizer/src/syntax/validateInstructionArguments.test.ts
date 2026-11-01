import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import { classifyIdentifier } from './parseArgument';
import { SyntaxErrorCode, SyntaxRulesError } from './syntaxError';
import validateInstructionArguments from './validateInstructionArguments';

const { parseCompileTimeOperand } = await import('./parseArgument');

describe('validateInstructionArguments', () => {
	it('enforces missing arguments for known instruction arity', () => {
		expect(() => validateInstructionArguments('push', [])).toThrowError(SyntaxRulesError);
		expect(() => validateInstructionArguments('map', [])).toThrowError(SyntaxRulesError);
	});

	it('rejects unknown instruction names before argument validation', () => {
		expect(() => validateInstructionArguments('unknownInstruction', [])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION })
		);
	});

	it('rejects project-level instructions', () => {
		for (const instruction of ['group', 'groupEnd', 'expose', 'pass', 'init']) {
			expect(() => validateInstructionArguments(instruction, [])).toThrow(
				expect.objectContaining({ code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION })
			);
		}
	});

	it('accepts one-argument map rows', () => {
		expect(() =>
			validateInstructionArguments('map', [{ type: ArgumentType.LITERAL, value: 1, isInteger: true }])
		).not.toThrow();
	});

	it('rejects extra arguments for fixed-arity instructions', () => {
		expect(() =>
			validateInstructionArguments('push', [
				{ type: ArgumentType.LITERAL, value: 1, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
			])
		).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('module', [classifyIdentifier('main'), classifyIdentifier('extra')])
		).toThrowError(SyntaxRulesError);
		expect(() => validateInstructionArguments('abs', [classifyIdentifier('extra')])).toThrowError(SyntaxRulesError);
	});

	it('accepts one push-style arithmetic operand but rejects two', () => {
		expect(() => validateInstructionArguments('add', [])).not.toThrow();
		expect(() => validateInstructionArguments('add', [classifyIdentifier('*gain')])).not.toThrow();
		expect(() =>
			validateInstructionArguments('add', [classifyIdentifier('first'), classifyIdentifier('second')])
		).toThrowError(SyntaxRulesError);
	});

	it.each(['audioOut', 'XORShift', 'voice_1', 'low-pass', '_internal'])('accepts the module name %s', moduleName => {
		expect(() => validateInstructionArguments('module', [classifyIdentifier(moduleName)])).not.toThrow();
	});

	it.each(['1voice', 'voice/left', 'voice%left', 'voice?left', 'voice#left', 'voice@left', 'voice:left', 'voice.left'])(
		'rejects the module name %s as an invalid identifier',
		moduleName => {
			expect(() => validateInstructionArguments('module', [classifyIdentifier(moduleName)])).toThrow(
				expect.objectContaining({ code: SyntaxErrorCode.INVALID_IDENTIFIER })
			);
		}
	);

	it('accepts compile-time values for default', () => {
		expect(() =>
			validateInstructionArguments('default', [
				{
					type: ArgumentType.COMPILE_TIME_EXPRESSION,
					left: parseCompileTimeOperand('SIZE'),
					operator: '*',
					right: parseCompileTimeOperand('2'),
				},
			])
		).not.toThrow();
	});

	it('rejects non-single-character string literals in map', () => {
		expect(() =>
			validateInstructionArguments('map', [
				{ type: ArgumentType.STRING_LITERAL, value: 'AB' },
				{ type: ArgumentType.LITERAL, value: 1, isInteger: true },
			])
		).toThrowError(SyntaxRulesError);
	});

	it('rejects unsupported type identifiers', () => {
		expect(() =>
			validateInstructionArguments('param', [classifyIdentifier('bool'), classifyIdentifier('x')])
		).toThrowError(SyntaxRulesError);
	});

	it('accepts pointer type identifiers for params, locals, and functionEnd', () => {
		expect(() =>
			validateInstructionArguments('param', [classifyIdentifier('float*'), classifyIdentifier('buffer')])
		).not.toThrow();
		expect(() =>
			validateInstructionArguments('param', [classifyIdentifier('int8u*'), classifyIdentifier('bytes')])
		).not.toThrow();
		expect(() =>
			validateInstructionArguments('local', [classifyIdentifier('int16**'), classifyIdentifier('cursor')])
		).not.toThrow();
		expect(() =>
			validateInstructionArguments('local', [classifyIdentifier('int16u**'), classifyIdentifier('cursor')])
		).not.toThrow();
		expect(() => validateInstructionArguments('functionEnd', [classifyIdentifier('float64*')])).not.toThrow();
		expect(() => validateInstructionArguments('functionEnd', [classifyIdentifier('int8u*')])).not.toThrow();
	});

	it('still rejects pointer type identifiers where only scalar types are valid', () => {
		expect(() => validateInstructionArguments('mapBegin', [classifyIdentifier('float*')])).toThrowError(
			SyntaxRulesError
		);
	});

	it('accepts bare #impure and rejects any arguments', () => {
		expect(() => validateInstructionArguments('#impure', [])).not.toThrow();
		expect(() => validateInstructionArguments('#impure', [classifyIdentifier('x')])).toThrowError(SyntaxRulesError);
	});

	it('accepts an optional identifier argument for #export', () => {
		expect(() => validateInstructionArguments('#export', [classifyIdentifier('onMidiCC')])).not.toThrow();
		expect(() => validateInstructionArguments('#export', [])).not.toThrow();
		expect(() =>
			validateInstructionArguments('#export', [classifyIdentifier('onMidiCC'), classifyIdentifier('extra')])
		).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('#export', [{ type: ArgumentType.LITERAL, value: 1, isInteger: true }])
		).toThrowError(SyntaxRulesError);
	});

	it('accepts one identifier or string literal field argument for #import', () => {
		expect(() => validateInstructionArguments('#import', [classifyIdentifier('log')])).not.toThrow();
		expect(() =>
			validateInstructionArguments('#import', [{ type: ArgumentType.STRING_LITERAL, value: 'log.value' }])
		).not.toThrow();
		expect(() => validateInstructionArguments('#import', [])).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('#import', [classifyIdentifier('log'), classifyIdentifier('extra')])
		).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('#import', [{ type: ArgumentType.LITERAL, value: 1, isInteger: true }])
		).toThrowError(SyntaxRulesError);
	});

	it('accepts bare exitIfTrue and rejects any arguments', () => {
		expect(() => validateInstructionArguments('exitIfTrue', [])).not.toThrow();
		expect(() => validateInstructionArguments('exitIfTrue', [classifyIdentifier('x')])).toThrowError(SyntaxRulesError);
	});

	it('accepts an optional literal fallback for ensureNonZero', () => {
		expect(() => validateInstructionArguments('ensureNonZero', [])).not.toThrow();
		expect(() =>
			validateInstructionArguments('ensureNonZero', [{ type: ArgumentType.LITERAL, value: 0.000001, isInteger: false }])
		).not.toThrow();
		expect(() => validateInstructionArguments('ensureNonZero', [classifyIdentifier('fallback')])).toThrowError(
			SyntaxRulesError
		);
		expect(() =>
			validateInstructionArguments('ensureNonZero', [
				{ type: ArgumentType.LITERAL, value: 1, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
			])
		).toThrowError(SyntaxRulesError);
	});

	it('requires a non-negative compile-time byte count for memoryCopy', () => {
		expect(() =>
			validateInstructionArguments('memoryCopy', [{ type: ArgumentType.LITERAL, value: 20, isInteger: true }])
		).not.toThrow();
		expect(() => validateInstructionArguments('memoryCopy', [classifyIdentifier('sizeof(buffer)')])).not.toThrow();
		expect(() => validateInstructionArguments('memoryCopy', [])).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('memoryCopy', [{ type: ArgumentType.LITERAL, value: -1, isInteger: true }])
		).toThrowError(SyntaxRulesError);
	});

	it('accepts multiple result types for ifEnd', () => {
		expect(() =>
			validateInstructionArguments('ifEnd', [
				classifyIdentifier('int'),
				classifyIdentifier('float'),
				classifyIdentifier('int'),
			])
		).not.toThrow();
	});

	it('accepts inline push values after call targets', () => {
		expect(() =>
			validateInstructionArguments('call', [
				classifyIdentifier('foo'),
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 1.3, isInteger: false },
				{ type: ArgumentType.STRING_LITERAL, value: 'ok' },
			])
		).not.toThrow();
	});

	it('rejects non-constant identifiers for const declarations', () => {
		expect(() =>
			validateInstructionArguments('const', [
				classifyIdentifier('foo'),
				{ type: ArgumentType.LITERAL, value: 1, isInteger: true },
			])
		).toThrowError(SyntaxRulesError);
	});

	it('validates array declaration argument shapes', () => {
		expect(() =>
			validateInstructionArguments('int[]', [
				classifyIdentifier('values'),
				{ type: ArgumentType.LITERAL, value: 8, isInteger: true },
			])
		).not.toThrow();
	});

	it('accepts inline array initializer values', () => {
		expect(() =>
			validateInstructionArguments('int[]', [
				classifyIdentifier('values'),
				{ type: ArgumentType.LITERAL, value: 8, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 48, isInteger: true },
				classifyIdentifier('NOTE'),
				{
					type: ArgumentType.COMPILE_TIME_EXPRESSION,
					left: parseCompileTimeOperand('NOTE'),
					operator: '+',
					right: parseCompileTimeOperand('1'),
				},
			])
		).not.toThrow();
	});

	it('rejects non compile-time inline array initializer values', () => {
		expect(() =>
			validateInstructionArguments('int[]', [
				classifyIdentifier('values'),
				{ type: ArgumentType.LITERAL, value: 8, isInteger: true },
				{ type: ArgumentType.STRING_LITERAL, value: 'AB' },
			])
		).toThrowError(SyntaxRulesError);
	});

	it('rejects any argument for block', () => {
		expect(() => validateInstructionArguments('block', [classifyIdentifier('int')])).toThrowError(SyntaxRulesError);
		expect(() => validateInstructionArguments('block', [classifyIdentifier('float')])).toThrowError(SyntaxRulesError);
		expect(() => validateInstructionArguments('block', [classifyIdentifier('void')])).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('block', [{ type: ArgumentType.LITERAL, value: 1, isInteger: true }])
		).toThrowError(SyntaxRulesError);
	});

	it('accepts bare blockEnd', () => {
		expect(() => validateInstructionArguments('blockEnd', [])).not.toThrow();
	});

	it('accepts optional non-negative compile-time access widths for address clamps', () => {
		expect(() => validateInstructionArguments('clampAddress', [])).not.toThrow();
		expect(() =>
			validateInstructionArguments('clampModuleAddress', [{ type: ArgumentType.LITERAL, value: 4, isInteger: true }])
		).not.toThrow();
		expect(() => validateInstructionArguments('clampAddress', [classifyIdentifier('sizeof(buffer)')])).not.toThrow();
		expect(() =>
			validateInstructionArguments('clampGlobalAddress', [{ type: ArgumentType.LITERAL, value: -1, isInteger: true }])
		).toThrowError(SyntaxRulesError);
		expect(() =>
			validateInstructionArguments('clampAddress', [
				{ type: ArgumentType.LITERAL, value: 4, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 4, isInteger: true },
			])
		).toThrowError(SyntaxRulesError);
	});

	it('accepts blockEnd with int or float', () => {
		expect(() => validateInstructionArguments('blockEnd', [classifyIdentifier('int')])).not.toThrow();
		expect(() => validateInstructionArguments('blockEnd', [classifyIdentifier('float')])).not.toThrow();
	});

	it('rejects blockEnd with invalid type identifiers', () => {
		expect(() => validateInstructionArguments('blockEnd', [classifyIdentifier('void')])).toThrowError(SyntaxRulesError);
		expect(() => validateInstructionArguments('blockEnd', [classifyIdentifier('bool')])).toThrowError(SyntaxRulesError);
		expect(() => validateInstructionArguments('blockEnd', [classifyIdentifier('string')])).toThrowError(
			SyntaxRulesError
		);
	});

	it('rejects too many result types for blockEnd', () => {
		expect(() =>
			validateInstructionArguments('blockEnd', [classifyIdentifier('int'), classifyIdentifier('float')])
		).toThrowError(SyntaxRulesError);
	});

	it.each(['branch', 'branchIfTrue'] as const)(
		'requires one non-negative integer literal argument for %s',
		instruction => {
			for (const validArg of [
				{ type: ArgumentType.LITERAL as const, value: 0, isInteger: true },
				{ type: ArgumentType.LITERAL as const, value: 1, isInteger: true },
				{ type: ArgumentType.LITERAL as const, value: 0x10, isInteger: true, isHex: true },
				{ type: ArgumentType.LITERAL as const, value: 0b10, isInteger: true },
			]) {
				expect(() => validateInstructionArguments(instruction, [validArg])).not.toThrow();
			}

			for (const invalidArg of [
				{ type: ArgumentType.LITERAL as const, value: -1, isInteger: true },
				{ type: ArgumentType.LITERAL as const, value: 0.5, isInteger: false },
				{ type: ArgumentType.LITERAL as const, value: 1, isInteger: false },
				{ type: ArgumentType.LITERAL as const, value: 1, isInteger: false, isFloat64: true },
				classifyIdentifier('DEPTH'),
			]) {
				expect(() => validateInstructionArguments(instruction, [invalidArg])).toThrow(
					expect.objectContaining({ code: SyntaxErrorCode.INVALID_ARGUMENT })
				);
			}

			expect(() => validateInstructionArguments(instruction, [])).toThrow(
				expect.objectContaining({ code: SyntaxErrorCode.MISSING_ARGUMENT })
			);
			expect(() =>
				validateInstructionArguments(instruction, [
					{ type: ArgumentType.LITERAL, value: 0, isInteger: true },
					{ type: ArgumentType.LITERAL, value: 1, isInteger: true },
				])
			).toThrow(expect.objectContaining({ code: SyntaxErrorCode.INVALID_ARGUMENT }));
		}
	);
});
