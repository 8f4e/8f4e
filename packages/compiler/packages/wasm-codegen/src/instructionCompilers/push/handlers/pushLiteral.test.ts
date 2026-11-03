import { f64const, i32const } from '@8f4e/compiler-wasm-utils';
import type { ArgumentLiteral } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext from '../../../../tests/testUtils';
import pushLiteral from './pushLiteral';

describe('pushLiteral', () => {
	it('emits i32.const for integer literals', () => {
		const context = createInstructionCompilerTestContext();
		const literal: ArgumentLiteral = {
			type: ArgumentType.LITERAL,
			value: 7,
			isInteger: true,
		};

		pushLiteral(literal, context);

		expect(context.byteCode).toEqual(i32const(7));
	});

	it('emits f64.const for float64 literals', () => {
		const context = createInstructionCompilerTestContext();
		const literal: ArgumentLiteral = {
			type: ArgumentType.LITERAL,
			value: 1.5,
			isInteger: false,
			isFloat64: true,
		};

		pushLiteral(literal, context);

		expect(context.byteCode).toEqual(f64const(1.5));
	});
});
