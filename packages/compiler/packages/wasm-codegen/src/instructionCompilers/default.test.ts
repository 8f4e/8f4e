import { ArgumentType, BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import _default from './default';

describe('default instruction compiler', () => {
	it('records a default value', () => {
		const context = createInstructionCompilerTestContext({
			blockStack: [
				{
					blockType: BlockType.MODULE,
					expectedResultTypes: [],
				},
				{
					blockType: BlockType.MAP,
					expectedResultTypes: [],
					mapState: {
						inputIsInteger: true,
						inputIsFloat64: false,
						rows: [],
						defaultSet: false,
					},
				},
			],
		});

		compileInstructionForTest(
			_default,
			{
				lineNumber: 1,
				instruction: 'default',
				arguments: [{ type: ArgumentType.LITERAL, value: 99, isInteger: true }],
			},
			context
		);

		expect({
			mapState: context.activeMapBlock?.mapState,
		}).toMatchSnapshot();
	});
});
