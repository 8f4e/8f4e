import type { InstructionCompiler, MapBeginLine } from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { pushBlock } from '@8f4e/semantic-utils';

/**
 * Instruction compiler for `mapBegin`.
 * Opens a map block scope and records the input type for the mapping operation.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const mapBegin: InstructionCompiler<MapBeginLine> = (line: MapBeginLine, context) => {
	const inputType = line.arguments[0].value;

	pushBlock(context, {
		expectedResultTypes: [],
		blockType: BlockType.MAP,
		mapState: {
			inputIsInteger: inputType === 'int',
			inputIsFloat64: inputType === 'float64',
			rows: [],
			defaultSet: false,
		},
	});

	return context;
};

export default mapBegin;
