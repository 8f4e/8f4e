import { describe, expect, it } from 'vitest';
import { ArgumentType } from './arguments';
import type { CompilerASTLine } from './ast';
import { getError } from './compilerError';
import { ErrorCode } from './errors';

describe('getError', () => {
	const line = {
		lineNumber: 1,
		instruction: 'push',
		arguments: [],
	} as CompilerASTLine;

	it('returns a diagnostic for every compiler error code', () => {
		for (const code of Object.values(ErrorCode)) {
			const error = getError(code, line);

			expect(error.code).toBe(code);
			expect(error.line).toBe(line);
			expect(error.message).toContain(`(${code})`);
		}
	});

	it('formats stack mismatch diagnostics with stack item types', () => {
		const context = {
			stack: [
				{ kind: 'value', valueType: 'int' },
				{ kind: 'address', valueType: 'int' },
			],
		};

		const error = getError(ErrorCode.STACK_EXPECTED_ZERO_ELEMENTS, line, context);

		expect(error.message).toBe(
			`1: Expected 0 elements on the stack, found 2 [int, address] (${ErrorCode.STACK_EXPECTED_ZERO_ELEMENTS})`
		);
	});

	it('includes optional identifiers in memory metadata errors', () => {
		expect(getError(ErrorCode.RESERVED_MEMORY_IDENTIFIER, line, undefined, { identifier: 'this' }).message).toBe(
			`Reserved identifier cannot be used as a memory allocation name: this. (${ErrorCode.RESERVED_MEMORY_IDENTIFIER})`
		);
		expect(
			getError(ErrorCode.POINTEE_WORD_SIZE_ON_NON_POINTER, line, undefined, { identifier: 'count' }).message
		).toContain('"count" is not a pointer');
		expect(
			getError(ErrorCode.POINTEE_ELEMENT_MAX_ON_NON_POINTER, line, undefined, { identifier: 'peak' }).message
		).toContain('"peak" is not a pointer');
	});

	it('includes the undeclared identifier when provided', () => {
		const localLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [{ type: ArgumentType.IDENTIFIER, value: 'missingLocal' }],
		} as CompilerASTLine;

		const error = getError(ErrorCode.UNDECLARED_IDENTIFIER, localLine, undefined, { identifier: 'missingLocal' });

		expect(error.message).toBe(`Undeclared identifier: missingLocal. (${ErrorCode.UNDECLARED_IDENTIFIER})`);
	});

	it('keeps the generic undeclared identifier message when no identifier is available', () => {
		const line = {
			lineNumber: 1,
			instruction: 'use',
			arguments: [],
		} as CompilerASTLine;

		const error = getError(ErrorCode.UNDECLARED_IDENTIFIER, line);

		expect(error.message).toBe(`Undeclared identifier. (${ErrorCode.UNDECLARED_IDENTIFIER})`);
	});

	it('includes the duplicate identifier when provided', () => {
		const line = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [{ type: ArgumentType.IDENTIFIER, value: 'same' }],
		} as CompilerASTLine;

		const error = getError(ErrorCode.DUPLICATE_IDENTIFIER, line, undefined, { identifier: 'same' });

		expect(error.message).toBe(
			`Duplicate identifier: same. Module and function names must be unique. (${ErrorCode.DUPLICATE_IDENTIFIER})`
		);
	});
	it('explains that the pointee address prefix requires a pointer', () => {
		const error = getError(ErrorCode.POINTEE_ADDRESS_REQUIRES_POINTER, line, undefined, { identifier: 'value' });

		expect(error.message).toContain('pointee address prefix requires a pointer-typed identifier');
		expect(error.message).toContain('value');
	});
});
