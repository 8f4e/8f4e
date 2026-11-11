import { describe, expect, it } from 'vitest';
import { classifyEndQuery } from './classifyEndQuery';
import { classifyIdentifier } from './classifyIdentifier';

describe('exclusive-end query syntax', () => {
	it.each([
		['end(buffer)', { scope: 'local', targetKind: 'memory', targetMemoryId: 'buffer' }],
		['end(*connection)', { scope: 'local', targetKind: 'pointee', targetMemoryId: 'connection' }],
		['end(this)', { scope: 'local', targetKind: 'memory', targetMemoryId: 'this' }],
		[
			'end(source:buffer)',
			{ scope: 'intermodule', targetKind: 'memory', targetModuleId: 'source', targetMemoryId: 'buffer' },
		],
		['end(source:)', { scope: 'intermodule', targetKind: 'module', targetModuleId: 'source' }],
		[
			'end(source:2)',
			{ scope: 'intermodule', targetKind: 'indexed-memory', targetModuleId: 'source', targetMemoryIndex: 2 },
		],
	])('parses %s as a first-class query', (value, target) =>
		expect(classifyEndQuery(value)).toEqual({ type: 'identifier', referenceKind: 'end-address', value, ...target })
	);
	it.each([
		'end()',
		'end(*)',
		'end(**buffer)',
		'end(&buffer)',
		'end(source:buffer:other)',
		'end(buffer',
		'end(end(buffer))',
	])('rejects malformed %s', value => expect(() => classifyEndQuery(value)).toThrow());
	it.each(['buffer&', 'source:buffer&', 'source:&', '&source:buffer&'])('rejects removed trailing syntax %s', value =>
		expect(() => classifyIdentifier(value)).toThrow('Trailing & end addresses were removed')
	);
	it('does not classify a start address as a query', () => expect(classifyEndQuery('&buffer')).toBeNull());
});
