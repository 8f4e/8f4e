import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import mapEnd from './mapEnd';

const { classifyIdentifier } = await import('@8f4e/tokenizer');

describe('mapEnd instruction compiler', () => {
	it('uses only input and result locals without reordering the source rows', () => {
		const rows = [
			{ keyValue: 1, valueValue: 10, valueIsInteger: true, valueIsFloat64: false },
			{ keyValue: 2, valueValue: 20, valueIsInteger: true, valueIsFloat64: false },
			{ keyValue: 1, valueValue: 30, valueIsInteger: true, valueIsFloat64: false },
		];
		const originalRows = structuredClone(rows);
		const context = createInstructionCompilerTestContext({
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{
					blockType: BlockType.MAP,
					expectedResultTypes: [],
					mapState: {
						inputIsInteger: true,
						inputIsFloat64: false,
						rows,
						defaultSet: true,
						defaultValue: -7,
					},
				},
			],
		});
		compileInstructionForTest(
			mapEnd,
			{ lineNumber: 1, instruction: 'mapEnd', arguments: [classifyIdentifier('int')] },
			context,
			createStackFacts({ map: { inputKind: 'int32', outputKind: 'int32' } })
		);

		expect(Object.keys(context.locals)).toHaveLength(2);
		expect(rows).toEqual(originalRows);
		expect({ byteCode: context.byteCode, locals: context.locals }).toMatchSnapshot();
	});

	it('emits DROP + typed zero for zero rows', () => {
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
			mapEnd,
			{
				lineNumber: 1,
				instruction: 'mapEnd',
				arguments: [classifyIdentifier('int')],
			},
			context,
			createStackFacts({ map: { inputKind: 'int32', outputKind: 'int32' } })
		);

		expect({
			byteCode: context.byteCode,
			blockStack: context.blockStack,
		}).toMatchSnapshot();
	});
});
