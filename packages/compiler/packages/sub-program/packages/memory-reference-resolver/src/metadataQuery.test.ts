import { classifyIdentifier, parseCompileTimeOperand } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { evaluateMetadataQuery, getMetadataQuery } from './metadataQuery';

describe('getMetadataQuery', () => {
	it.each(['count', 'sizeof', 'max', 'min'] as const)('normalizes %s without reparsing token text', query => {
		for (const [name, scope, dereferenceDepth] of [
			['samples', 'local', 0],
			['source:samples', 'intermodule', 0],
			['*samples', 'local', 1],
		] as const) {
			const operand = { ...classifyIdentifier(`${query}(${name})`), value: 'already-classified' };
			expect(getMetadataQuery(operand)).toEqual({
				query,
				scope,
				targetMemoryId: 'samples',
				dereferenceDepth,
				...(scope === 'intermodule' ? { targetModuleId: 'source' } : {}),
			});
		}
	});

	it.each(['123', 'plain', '&samples', '*samples', '&source:samples', '&source:'])(
		'leaves nonmetadata operand %s to the other resolvers',
		value => expect(getMetadataQuery(parseCompileTimeOperand(value))).toBeUndefined()
	);
});

describe('evaluateMetadataQuery', () => {
	it.each([0, 1, 7])('retains a known count of %i before considering a fallback', count => {
		expect(
			evaluateMetadataQuery('count', {
				kind: 'pointer',
				pointers: [
					{ pointeeBaseType: 'float64', pointerDepth: 1, pointeeElementCount: count },
					{ pointeeBaseType: 'int8', pointerDepth: 1, pointeeElementCount: 5 },
				],
			})
		).toEqual({ value: count, isInteger: true });
	});

	it('uses the same pointee helpers for every pointer source and retains the count fallback', () => {
		const target = {
			kind: 'pointer',
			pointers: [
				{ pointeeBaseType: 'float64', pointerDepth: 2 },
				{ pointeeBaseType: 'int8', pointerDepth: 1, pointeeElementCount: 5 },
			],
		} as const;
		expect(evaluateMetadataQuery('count', target)).toEqual({ value: 5, isInteger: true });
		expect(evaluateMetadataQuery('sizeof', target)).toEqual({ value: 4, isInteger: true });
		expect(evaluateMetadataQuery('max', target)).toEqual({ value: 2147483647, isInteger: true });
		expect(evaluateMetadataQuery('min', target)).toEqual({ value: -2147483648, isInteger: true });
	});

	it('leaves an unknown count unresolved', () => {
		expect(
			evaluateMetadataQuery('count', {
				kind: 'pointer',
				pointers: [{ pointeeBaseType: 'int', pointerDepth: 1 }],
			})
		).toBeUndefined();
	});
});
