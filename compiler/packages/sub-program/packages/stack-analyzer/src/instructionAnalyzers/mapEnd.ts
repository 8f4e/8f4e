import type { CompilationContext, MapEndLine, Stack } from '@8f4e/language-spec';
import { resolveMapKind } from '@8f4e/semantic-utils';
import { validateMapValueKind } from '../mapValueKind';
import { consume, createStackValue, produce } from './stack';
import type { InstructionAnalysisResult } from './types';

/**
 * Validates active map input/output values and produces the map result stack item.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the map end instruction.
 */
export function analyzeMapEnd(line: MapEndLine, context: CompilationContext): InstructionAnalysisResult {
	const { mapState } = context.activeMapBlock!;

	const outputType = line.arguments[0].value;
	const outputIsInteger = outputType === 'int';
	const outputIsFloat64 = outputType === 'float64';
	const outputKind = resolveMapKind({
		valueType: outputIsInteger ? 'int' : outputIsFloat64 ? 'float64' : 'float',
	});
	const inputKind = resolveMapKind({
		valueType: mapState.inputIsInteger ? 'int' : mapState.inputIsFloat64 ? 'float64' : 'float',
	});
	const inputOperand = context.stack[context.stack.length - 1];

	validateMapValueKind(inputOperand, inputKind, line, context);

	for (const row of mapState.rows) {
		validateMapValueKind(
			{
				valueType: row.valueIsInteger ? 'int' : row.valueIsFloat64 ? 'float64' : 'float',
			},
			outputKind,
			line,
			context
		);
	}

	if (mapState.defaultSet) {
		validateMapValueKind(
			{
				valueType: mapState.defaultIsInteger ? 'int' : mapState.defaultIsFloat64 ? 'float64' : 'float',
			},
			outputKind,
			line,
			context
		);
	}

	const consumed = consume(context, 1);
	const produced: Stack = [createStackValue(outputIsInteger ? 'int' : outputIsFloat64 ? 'float64' : 'float')];
	produce(context, produced);
	return { consumed, produced, map: { inputKind, outputKind } };
}
