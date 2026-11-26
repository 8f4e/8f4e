import { expect, test } from 'vitest';
import { WASM_TYPE_I32 } from '../type';
import createLocalDeclaration from './createLocalDeclaration';

test('createLocalDeclaration generates correct format', () => {
	const decl = createLocalDeclaration(WASM_TYPE_I32, 2);
	expect(decl).toStrictEqual([2, WASM_TYPE_I32]);
});
