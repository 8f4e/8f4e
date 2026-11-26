import type { InstructionCompiler, ResolvedDefaultLine } from '@8f4e/language-spec';

/**
 * Instruction compiler for `default`.
 * Records an explicit default value within a map block. No bytecode is emitted;
 * lowering happens at `mapEnd`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const _default: InstructionCompiler<ResolvedDefaultLine> = (line: ResolvedDefaultLine, context) => {
	const { mapState } = context.activeMapBlock!;

	const valueArg = line.arguments[0];
	const defaultValue = valueArg.value;
	const defaultIsInteger = valueArg.isInteger;
	const defaultIsFloat64 = !!valueArg.isFloat64;

	mapState.defaultValue = defaultValue;
	mapState.defaultIsInteger = defaultIsInteger;
	mapState.defaultIsFloat64 = defaultIsFloat64;
	mapState.defaultSet = true;

	return context;
};

export default _default;
