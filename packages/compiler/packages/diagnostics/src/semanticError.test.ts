import type { CompilerDiagnosticLine } from '@8f4e/language-spec';
import { ArgumentType, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { getError } from './semanticError';

describe('getError', () => {
	const line = {
		diagnosticSource: { kind: 'document' },
		lineNumber: 1,
		instruction: 'push',
		arguments: [],
	} satisfies CompilerDiagnosticLine;

	it('returns a diagnostic for every compiler error code', () => {
		for (const code of Object.values(ErrorCode)) {
			const error = getError(code, line);

			expect(error.diagnostic.code).toBe(code);
			expect(error.diagnostic.location).toEqual({ kind: 'document', lineNumber: line.lineNumber });
			expect(error.message).toContain(`(${code})`);
		}
	});

	it('formats stack mismatch diagnostics with stack item types', () => {
		const context = {
			codeBlockId: 'example',
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
			diagnosticSource: { kind: 'document' },
			lineNumber: 1,
			instruction: 'push',
			arguments: [{ type: ArgumentType.IDENTIFIER, value: 'missingLocal' }],
		} satisfies CompilerDiagnosticLine;

		const error = getError(ErrorCode.UNDECLARED_IDENTIFIER, localLine, undefined, { identifier: 'missingLocal' });

		expect(error.message).toBe(`Undeclared identifier: missingLocal. (${ErrorCode.UNDECLARED_IDENTIFIER})`);
	});

	it('keeps the generic undeclared identifier message when no identifier is available', () => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 1,
			instruction: 'use',
			arguments: [],
		} satisfies CompilerDiagnosticLine;

		const error = getError(ErrorCode.UNDECLARED_IDENTIFIER, line);

		expect(error.message).toBe(`Undeclared identifier. (${ErrorCode.UNDECLARED_IDENTIFIER})`);
	});

	it('includes the duplicate identifier when provided', () => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 1,
			instruction: 'module',
			arguments: [{ type: ArgumentType.IDENTIFIER, value: 'same' }],
		} satisfies CompilerDiagnosticLine;

		const error = getError(ErrorCode.DUPLICATE_IDENTIFIER, line, undefined, { identifier: 'same' });

		expect(error.message).toBe(`Duplicate identifier: same. (${ErrorCode.DUPLICATE_IDENTIFIER})`);
	});
});
