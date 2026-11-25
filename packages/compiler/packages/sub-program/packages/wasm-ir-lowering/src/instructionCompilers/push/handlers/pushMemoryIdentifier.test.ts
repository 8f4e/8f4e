import type { ResolvedMemoryPushLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { createMemory } from '../../../../tests/memoryFixtures';
import createInstructionCompilerTestContext, { identifier } from '../../../../tests/testUtils';
import { i32const, i32load } from '../../../operations';
import pushMemoryIdentifier from './pushMemoryIdentifier';

describe('pushMemoryIdentifier', () => {
	it('loads memory value at byteAddress', () => {
		const context = createInstructionCompilerTestContext();
		const memoryItem = createMemory({ id: 0, name: 'value', byteAddress: 8 });

		pushMemoryIdentifier(
			{
				diagnosticSource: { kind: 'document' },
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
