import { describe, expect, it } from 'vitest';
import { hasIntermodularMemoryConnections, removeIntermodularMemoryConnectionsFromCode } from './removeConnections';

describe('remove intermodular memory connections from code', () => {
	it('removes an intermodular scalar memory default', () => {
		const result = removeIntermodularMemoryConnectionsFromCode(['module synth', 'float foo &module:bar', 'moduleEnd']);

		expect(result).toEqual(['module synth', 'float foo', 'moduleEnd']);
	});

	it('keeps local memory references', () => {
		const code = ['module synth', 'float bar &bar', 'moduleEnd'];

		expect(removeIntermodularMemoryConnectionsFromCode(code)).toBeUndefined();
		expect(hasIntermodularMemoryConnections(code)).toBe(false);
	});

	it('preserves inline comments and directives', () => {
		const result = removeIntermodularMemoryConnectionsFromCode([
			'module synth',
			'float foo &module:bar ; @customControl &foo 0 1 0.01',
			'moduleEnd',
		]);

		expect(result).toEqual(['module synth', 'float foo ; @customControl &foo 0 1 0.01', 'moduleEnd']);
	});

	it('preserves quoted semicolons and escaped quotes while removing a default', () => {
		const result = removeIntermodularMemoryConnectionsFromCode([
			'module synth',
			'int label "a; \\"b\\"" &source:value ; keep this comment',
			'moduleEnd',
		]);

		expect(result).toEqual(['module synth', 'int label "a; \\"b\\"" ; keep this comment', 'moduleEnd']);
	});

	it('leaves incomplete source alone while disconnecting other declarations', () => {
		const result = removeIntermodularMemoryConnectionsFromCode([
			'module synth',
			'int unfinished "',
			'float foo &source:value',
			'moduleEnd',
		]);

		expect(result).toEqual(['module synth', 'int unfinished "', 'float foo', 'moduleEnd']);
	});

	it('removes intermodular array defaults while preserving array size and local defaults', () => {
		const result = removeIntermodularMemoryConnectionsFromCode([
			'module synth',
			'int[] buffer 4 &source:head &tail',
			'moduleEnd',
		]);

		expect(result).toEqual(['module synth', 'int[] buffer 4 &tail', 'moduleEnd']);
	});

	it('removes intermodular element queries and end-address references', () => {
		const result = removeIntermodularMemoryConnectionsFromCode([
			'module synth',
			'int countSource count(source:values)',
			'int endSource source:values&',
			'moduleEnd',
		]);

		expect(result).toEqual(['module synth', 'int countSource', 'int endSource', 'moduleEnd']);
	});

	it('removes an intermodular rounded single-operand default', () => {
		const result = removeIntermodularMemoryConnectionsFromCode([
			'module synth',
			'int size round(sizeof(source:buffer))',
			'moduleEnd',
		]);

		expect(result).toEqual(['module synth', 'int size', 'moduleEnd']);
	});
});
