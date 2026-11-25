import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { parseArgument, parseLine, parseMemoryInstructionArgumentsShape } from './public';
import { SyntaxErrorCode } from './syntaxError';

describe('public syntax results', () => {
	it('returns failure data when no source position is available', () => {
		expect(parseArgument(String.raw`"\q"`)).toMatchObject({
			ok: false,
			issue: { code: SyntaxErrorCode.INVALID_STRING_LITERAL },
		});
		expect(parseMemoryInstructionArgumentsShape([])).toEqual({
			ok: false,
			issue: { code: SyntaxErrorCode.MISSING_ARGUMENT, message: 'Missing required argument.' },
		});
	});
	it('keeps the source row when parsing a complete instruction fails', () => {
		expect(parseLine('push', 8)).toMatchObject({
			ok: false,
			issue: { code: SyntaxErrorCode.MISSING_ARGUMENT, line: { lineNumber: 8, instruction: 'push' } },
		});
	});
	it('returns the parsed value explicitly on success', () => {
		expect(parseArgument('42')).toEqual({
			ok: true,
			value: { type: ArgumentType.LITERAL, value: 42, isInteger: true },
		});
	});
});
