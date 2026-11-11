import type { CompilerASTLine, ValidatedAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileToAST } from '../index';
import createASTCache from './createASTCache';
import hashSource from './hashSource';

describe('compileToAST cache', () => {
	it('returns cached AST when source is unchanged', () => {
		const cache = createASTCache<ValidatedAST>();
		const code = ['module test', 'push 10', 'push 20', 'add', 'moduleEnd'];
		const first = compileToAST(code, { kind: 'document' }, cache, 'module:0');
		const second = compileToAST(code, { kind: 'document' }, cache, 'module:0');

		expect(second).toBe(first);
		expect(cache.entries.get('module:0')).toMatchObject({
			ast: first,
			hash: hashSource(code),
		});
		expect(cache.entries.get('module:0')?.hashInput).toBeUndefined();
		expect(cache.stats).toEqual({ hits: 1, misses: 1 });
	});

	it('stores obvious cache misses without hashing the source', () => {
		const cache = createASTCache<ValidatedAST>();
		const code = ['module test', 'push 10', 'moduleEnd'];
		const ast = compileToAST(code, { kind: 'document' }, cache, 'module:0');
		const entry = cache.entries.get('module:0');

		expect(entry).toMatchObject({
			ast,
			hashInput: {
				code,
			},
			lineCount: code.length,
		});
		expect(entry?.hash).toBeUndefined();
	});

	it('reparses when source changes for the same cache key', () => {
		const cache = createASTCache<ValidatedAST>();
		const first = compileToAST(['module test', 'push 10', 'moduleEnd'], { kind: 'document' }, cache, 'module:0');
		const second = compileToAST(['module test', 'push 20', 'moduleEnd'], { kind: 'document' }, cache, 'module:0');

		expect(second).not.toBe(first);
		expect(second.lines[1].arguments[0]).toMatchObject({ value: 20 });
		expect(cache.stats).toEqual({ hits: 0, misses: 2 });
	});

	it('reparses an in-place source edit before hashing and reuses the updated AST', () => {
		const cache = createASTCache<ValidatedAST>();
		const code = ['function example', 'push 1', 'functionEnd int'];
		const first = compileToAST(code, { kind: 'document' }, cache, 'example');

		code[1] = 'push 2';
		const second = compileToAST(code, { kind: 'document' }, cache, 'example');

		expect(second).not.toBe(first);
		expect(first.lines[1].arguments[0]).toMatchObject({ value: 1 });
		expect(second.lines[1].arguments[0]).toMatchObject({ value: 2 });
		expect(cache.stats).toEqual({ hits: 0, misses: 2 });

		const third = compileToAST(code, { kind: 'document' }, cache, 'example');

		expect(third).toBe(second);
		expect(cache.stats).toEqual({ hits: 1, misses: 2 });
	});

	it('reparses when source line count changes for the same cache key', () => {
		const cache = createASTCache<ValidatedAST>();
		const first = compileToAST(['module test', 'push 10', 'moduleEnd'], { kind: 'document' }, cache, 'module:0');
		const second = compileToAST(
			['module test', 'push 10', 'push 20', 'moduleEnd'],
			{ kind: 'document' },
			cache,
			'module:0'
		);

		expect(second).not.toBe(first);
		expect(cache.entries.get('module:0')).toMatchObject({
			ast: second,
			lineCount: 4,
		});
		expect(cache.stats).toEqual({ hits: 0, misses: 2 });
	});

	it('keeps distinct cache keys independent', () => {
		const cache = createASTCache<ValidatedAST>();
		const moduleAst = compileToAST(['module test', 'push 10', 'moduleEnd'], { kind: 'document' }, cache, 'module:0');
		const functionAst = compileToAST(
			['function test', 'push 10', 'functionEnd'],
			{ kind: 'document' },
			cache,
			'function:0'
		);

		expect(functionAst).not.toBe(moduleAst);
		expect(cache.entries.get('module:0')?.ast).toBe(moduleAst);
		expect(cache.entries.get('function:0')?.ast).toBe(functionAst);
		expect(cache.stats).toEqual({ hits: 0, misses: 2 });
	});
	it('binds cached syntax to the current source without changing earlier compilations', () => {
		const cache = createASTCache<ValidatedAST>();
		const code = ['module shared', 'int value', 'moduleEnd'];
		const first = compileToAST(code, { kind: 'block', projectBlockId: 4, projectGroupPath: 'left' }, cache, 'shared');
		const second = compileToAST(code, { kind: 'block', projectBlockId: 9, projectGroupPath: 'right' }, cache, 'shared');
		expect(first.lines[1].diagnosticSource).toEqual({ kind: 'block', projectBlockId: 4, projectGroupPath: 'left' });
		expect(second.lines[1].diagnosticSource).toEqual({ kind: 'block', projectBlockId: 9, projectGroupPath: 'right' });
		expect(second.type).toBe('module');
		if (second.type === 'module') expect(second.moduleLine).toBe(second.lines[0]);
		expect(cache.entries.get('shared')!.ast.lines[1].diagnosticSource).toEqual({ kind: 'document' });
		expect(cache.stats).toEqual({ hits: 1, misses: 1 });
	});

	it.each([
		{ name: 'module', code: ['module state', 'int value', 'moduleEnd'] },
		{ name: 'constants', code: ['constants settings', 'const SIZE 2', 'constantsEnd'] },
		{ name: 'prototype', code: ['prototype state', 'int value', 'prototypeEnd'] },
		{ name: 'exported function', code: ['function helper', '#export', 'functionEnd'] },
		{ name: 'imported function', code: ['function tick', '#import "tick"', 'functionEnd int'] },
	])('binds $name declaration references to the copied instruction stream', ({ code }) => {
		const source = { kind: 'block', projectBlockId: 7, projectGroupPath: 'audio' } as const;
		const ast = compileToAST(code, source);
		const expectLinked = (line: CompilerASTLine) => {
			expect(ast.lines).toContain(line);
			expect(line.diagnosticSource).toEqual(source);
		};
		for (const line of ast.lines) expect(line.diagnosticSource).toEqual(source);
		switch (ast.type) {
			case 'module':
				expectLinked(ast.moduleLine);
				break;
			case 'constants':
				expectLinked(ast.constantsLine);
				break;
			case 'prototype':
				expectLinked(ast.prototypeLine);
				break;
			case 'function':
				expectLinked(ast.functionLine);
				expectLinked(ast.functionEndLine);
				if (code.includes('#export')) expect(ast.exportLine).toBeDefined();
				if (code.includes('#import "tick"')) expect(ast.importLine).toBeDefined();
				if (ast.exportLine) expectLinked(ast.exportLine);
				if (ast.importLine) expectLinked(ast.importLine);
				break;
		}
	});
});
