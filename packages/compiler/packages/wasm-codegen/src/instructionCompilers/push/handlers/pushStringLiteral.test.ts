import { i32const } from '@8f4e/compiler-wasm-utils';
import type { ArgumentStringLiteral } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext from '../../../../tests/testUtils';
import pushStringLiteral from './pushStringLiteral';

describe('pushStringLiteral', () => {
	it('emits one i32.const per byte in source order', () => {
		const context = createInstructionCompilerTestContext();
		const arg: ArgumentStringLiteral = {
			type: ArgumentType.STRING_LITERAL,
			value: 'hi',
		};

		pushStringLiteral(arg, context);

		// 'h' = 104, 'i' = 105
		expect(context.byteCode).toEqual([...i32const(104), ...i32const(105)]);
	});

	it('pushes nothing for an empty string', () => {
		const context = createInstructionCompilerTestContext();
		const arg: ArgumentStringLiteral = {
			type: ArgumentType.STRING_LITERAL,
			value: '',
		};

		pushStringLiteral(arg, context);

		expect(context.byteCode).toEqual([]);
	});

	it('emits i32.const 0 for null byte and marks isNonZero false', () => {
		const context = createInstructionCompilerTestContext();
		const arg: ArgumentStringLiteral = {
			type: ArgumentType.STRING_LITERAL,
			value: '\x00',
		};

		pushStringLiteral(arg, context);

		expect(context.byteCode).toEqual(i32const(0));
	});

	it('expands "hello" to 5 byte pushes', () => {
		const context = createInstructionCompilerTestContext();
		const arg: ArgumentStringLiteral = {
			type: ArgumentType.STRING_LITERAL,
			value: 'hello',
		};

		pushStringLiteral(arg, context);

		// h=104, e=101, l=108, l=108, o=111
		const expected = [...i32const(104), ...i32const(101), ...i32const(108), ...i32const(108), ...i32const(111)];
		expect(context.byteCode).toEqual(expected);
	});
});
