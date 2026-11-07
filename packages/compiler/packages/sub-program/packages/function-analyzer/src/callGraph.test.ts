import { describe, expect, it } from 'vitest';
import { findRecursiveNodes } from './callGraph';

describe('recursive call components', () => {
	it('handles an empty program', () => {
		expect(findRecursiveNodes(new Map())).toEqual(new Set());
	});

	it('keeps shared callees and cross edges acyclic', () => {
		const graph = new Map([
			['root', ['left', 'right']],
			['left', ['right', 'leaf']],
			['right', ['leaf']],
			['leaf', []],
		]);
		expect(findRecursiveNodes(graph)).toEqual(new Set());
	});

	it('finds self recursion and mutual recursion without marking their callers or callees', () => {
		const graph = new Map([
			['caller', ['self', 'first']],
			['self', ['self', 'leaf']],
			['first', ['second']],
			['second', ['first', 'leaf']],
			['leaf', []],
			['unused', ['unused']],
		]);
		expect(findRecursiveNodes(graph)).toEqual(new Set(['self', 'first', 'second', 'unused']));
	});

	it('handles long call chains and cycles without exhausting the JavaScript call stack', () => {
		const length = 20_000;
		const graph = new Map(
			Array.from({ length }, (_, index) => [String(index), index + 1 < length ? [String(index + 1)] : []])
		);
		expect(findRecursiveNodes(graph).size).toBe(0);
		graph.set(String(length - 1), ['0']);
		expect(findRecursiveNodes(graph).size).toBe(length);
	});
});
