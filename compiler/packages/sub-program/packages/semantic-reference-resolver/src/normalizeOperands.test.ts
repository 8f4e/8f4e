import type { CompilerASTLine } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { normalizeOperands } from './normalizeOperands';

const value = { type: ArgumentType.LITERAL, value: 3, isInteger: true } as const;

describe('operand normalization', () => {
	it('expands arithmetic into ordinary operations without changing the source AST', () => {
		const source: CompilerASTLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 7,
			instruction: 'sub',
			arguments: [value],
		};
		expect(normalizeOperands(source)).toEqual([
			{ diagnosticSource: { kind: 'document' }, lineNumber: 7, instruction: 'push', arguments: [value] },
			{ diagnosticSource: { kind: 'document' }, lineNumber: 7, instruction: 'sub', arguments: [] },
		]);
		expect(source.arguments).toEqual([value]);
	});

	it('expands call operands in order and leaves only the function target', () => {
		const target = { type: ArgumentType.IDENTIFIER, value: 'mix', referenceKind: 'plain', scope: 'local' } as const;
		expect(
			normalizeOperands({
				diagnosticSource: { kind: 'document' },
				lineNumber: 9,
				instruction: 'call',
				arguments: [target, value, value],
			})
		).toEqual([
			{ diagnosticSource: { kind: 'document' }, lineNumber: 9, instruction: 'push', arguments: [value] },
			{ diagnosticSource: { kind: 'document' }, lineNumber: 9, instruction: 'push', arguments: [value] },
			{ diagnosticSource: { kind: 'document' }, lineNumber: 9, instruction: 'call', arguments: [target] },
		]);
	});

	it('keeps stack-only operations unchanged', () => {
		const source: CompilerASTLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'mul',
			arguments: [],
		};
		expect(normalizeOperands(source)).toEqual([source]);
	});
});
