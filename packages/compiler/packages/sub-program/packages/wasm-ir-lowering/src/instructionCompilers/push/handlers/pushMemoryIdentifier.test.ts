import type { ResolvedMemoryPushLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, { identifier } from '../../../../tests/testUtils';
import { i32const, i32load } from '../../../operations';
import pushMemoryIdentifier from './pushMemoryIdentifier';

describe('pushMemoryIdentifier', () => {
	it('loads memory value at byteAddress', () => {
		const context = createInstructionCompilerTestContext();
		const memoryItem = {
			id: 'value',
			numberOfElements: 1,
			elementWordSize: 4,
			allocationUnitAddress: 2,
			allocationUnitCount: 1,
			byteAddress: 8,
			default: 0,
			isInteger: true,
			pointerDepth: 0,
			isUnsigned: false,
			type: 'int',
		} as never;

		pushMemoryIdentifier(
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [identifier('value')],
				resolvedTarget: { kind: 'memory', memoryItem },
			} as ResolvedMemoryPushLine,
			context
		);

		expect(context.instructions).toEqual([...i32const(8), ...i32load()]);
	});
});
