import { expect, test } from 'vitest';

import i32store from './i32store';

test('i32store with no setup generates only store instruction', () => {
	const result = i32store();
	expect(result.slice(-3)).toStrictEqual([54, 2, 0]);
});

test('i32store with address and value generates full instruction sequence', () => {
	const result = i32store(100, 42);
	expect(result).toContain(54);
});
