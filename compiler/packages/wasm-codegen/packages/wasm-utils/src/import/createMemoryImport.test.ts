import { expect, test } from 'vitest';
import { ImportDesc } from '../section';
import createMemoryImport from './createMemoryImport';

test('createMemoryImport generates correct entry', () => {
	const imp = createMemoryImport('host', 'memory', 1);
	expect(imp.slice(-4)).toStrictEqual([ImportDesc.MEMORY, 0x03, 1, 1]);
});

test('createMemoryImport handles an explicit shared memory maximum', () => {
	const imp = createMemoryImport('host', 'memory', 1, 10);
	expect(imp.slice(-4)).toStrictEqual([ImportDesc.MEMORY, 0x03, 1, 10]);
	expect(imp.slice(-2)).toStrictEqual([1, 10]);
});
