import type { InstructionCompiler, ResolvedMapLine } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';

/**
 * Instruction compiler for `map`.
 * Records a key→value mapping entry within a map block. No bytecode is emitted;
 * lowering happens at `mapEnd`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const map: InstructionCompiler<ResolvedMapLine> = (line: ResolvedMapLine, context) => {
	const { mapState } = context.activeMapBlock!;
	const keyArg = line.arguments[0];
	const valueArg = line.arguments[1];

	let keyValue: number;

	if (keyArg.type === ArgumentType.LITERAL) {
		keyValue = keyArg.value;
	} else {
		keyValue = keyArg.value.charCodeAt(0);
	}

	let valueValue = 0;
	let valueIsInteger = false;
	let valueIsFloat64 = false;

	if (valueArg.type === ArgumentType.LITERAL) {
		valueValue = valueArg.value;
		valueIsInteger = valueArg.isInteger;
		valueIsFloat64 = !!valueArg.isFloat64;
	} else {
		valueValue = valueArg.value.charCodeAt(0);
		valueIsInteger = true;
	}

	mapState.rows.push({
		keyValue,
		valueValue,
		valueIsInteger,
		valueIsFloat64,
	});

	return context;
};

export default map;
