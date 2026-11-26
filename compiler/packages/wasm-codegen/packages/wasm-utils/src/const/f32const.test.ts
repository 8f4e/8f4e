import { expect, test } from 'vitest';

import f32const from './f32const';

test('f32const generates correct bytecode for various floats', () => {
	expect(f32const(1)).toStrictEqual([67, 0, 0, 128, 63]);
	expect(f32const(32)).toStrictEqual([67, 0, 0, 0, 66]);
	expect(f32const(256)).toStrictEqual([67, 0, 0, 128, 67]);
	expect(f32const(-1)).toStrictEqual([67, 0, 0, 128, 191]);
	expect(f32const(-256)).toStrictEqual([67, 0, 0, 128, 195]);
	expect(f32const(3.14)).toStrictEqual([67, 195, 245, 72, 64]);
});
