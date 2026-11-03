import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import clearStack from './clearStack';

describe('clearStack instruction compiler', () => {
	it('drops all stack values', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			clearStack,
			{
				lineNumber: 1,
				instruction: 'clearStack',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'float', isNonZero: true },
				],
				droppedStackItems: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'float', isNonZero: true },
				],
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});
});
