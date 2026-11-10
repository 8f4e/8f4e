import type { ResolvedLocalPushLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { identifier } from '../../../../tests/testUtils';
import pushLocal from './pushLocal';

describe('pushLocal', () => {
	it('pushes a local via local.get', () => {
		const context = createInstructionCompilerTestContext({
			locals: [{ isInteger: true }],
		});

		pushLocal(
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [identifier('temp')],
				resolvedTarget: { kind: 'local', binding: { id: 0, name: 'temp', type: 'int' } },
			} as ResolvedLocalPushLine,
			context
		);

		expect(context.instructions).toEqual([{ kind: 'local.get', binding: 0 }]);
	});
});
