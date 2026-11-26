import { expect, test } from 'vitest';

import f32store from './f32store';

test('f32store with no setup generates only store instruction', () => {
	const result = f32store();
	expect(result.slice(-3)).toStrictEqual([56, 2, 0]);
});

test('f32store with address and value generates full instruction sequence', () => {
	const result = f32store(100, 3.14);
	expect(result).toContain(56);
});
