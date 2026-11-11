import type { ResolvedLocalSetLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest, identifier } from '../../tests/testUtils';
import _localSet from './localSet';

describe('localSet instruction compiler', () => {
	it('stores a local value', () => {
		const context = createInstructionCompilerTestContext({
			locals: [{ isInteger: true }],
		});

		compileInstructionForTest(
			_localSet,
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'localSet',
				arguments: [identifier('value')],
				binding: { id: 0, name: 'value', type: 'int' },
			} as ResolvedLocalSetLine,
			context
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});
});
