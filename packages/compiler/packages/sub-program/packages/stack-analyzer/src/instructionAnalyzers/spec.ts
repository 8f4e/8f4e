import type {
	CompilationContext,
	CompilerASTLine,
	InstructionSpec,
	Stack,
	StackItem,
	StackMutationSpec,
	StackProducedItemSpec,
} from '@8f4e/language-spec';
import { ErrorCode, getError } from '@8f4e/language-spec';
import { consume, createStackValue, produce } from './stack';
import type { InstructionAnalysisResult } from './types';

function analyzeExpectedBlockResult(
	line: CompilerASTLine,
	context: CompilationContext,
	{ restore = false } = {}
): { consumed: Stack; produced: Stack } {
	const block = context.blockStack[context.blockStack.length - 1];
	const expectedResultTypes = block?.expectedResultTypes ?? [];

	if (expectedResultTypes.length === 0) {
		return { consumed: [], produced: [] };
	}

	const consumed = consume(context, expectedResultTypes.length);

	if (consumed.length < expectedResultTypes.length) {
		throw getError(ErrorCode.INSUFFICIENT_OPERANDS, line, context);
	}

	for (let index = 0; index < expectedResultTypes.length; index++) {
		const expectedResultType = expectedResultTypes[index];
		const operand = consumed[index];

		if (expectedResultType === 'int' && operand.valueType !== 'int') {
			throw getError(ErrorCode.ONLY_INTEGERS, line, context);
		}

		if (expectedResultType === 'float' && operand.valueType !== 'float') {
			throw getError(ErrorCode.ONLY_FLOATS, line, context);
		}
	}

	if (!restore) {
		return { consumed, produced: [] };
	}

	produce(context, consumed);
	return { consumed, produced: consumed };
}

function resolveStackConsumeCount(
	line: CompilerASTLine,
	context: CompilationContext,
	consumes: StackMutationSpec['consumes']
): number {
	if (consumes === 'all') {
		return context.stack.length;
	}

	if (typeof consumes === 'number') {
		return consumes;
	}

	const argument = line.arguments[consumes.argumentValueIndex];
	const value = argument && 'value' in argument && typeof argument.value === 'number' ? argument.value : 0;

	return value + consumes.add;
}

function resolveProducedStackItemNonZero(
	consumed: Stack,
	spec: StackProducedItemSpec,
	defaultValue: boolean | undefined
): boolean | undefined {
	if (spec.isNonZero === 'fromInput') {
		return consumed[spec.inputIndex ?? 0]?.isNonZero;
	}

	return spec.isNonZero ?? defaultValue;
}

function resolveStackProducedItem(consumed: Stack, spec: StackProducedItemSpec): StackItem {
	const input = consumed[spec.inputIndex ?? 0];

	switch (spec.kind) {
		case 'int':
			return createStackValue('int', {
				isNonZero: resolveProducedStackItemNonZero(consumed, spec, false),
			});
		case 'float':
			return createStackValue('float', {
				isNonZero: resolveProducedStackItemNonZero(consumed, spec, false),
			});
		case 'float64':
			return createStackValue('float64', {
				isNonZero: resolveProducedStackItemNonZero(consumed, spec, false),
			});
		case 'same':
		default:
			return createStackValue(input?.valueType ?? 'float', {
				isNonZero: resolveProducedStackItemNonZero(consumed, spec, input?.isNonZero),
			});
	}
}

function analyzeStackEffectFromSpec(
	line: CompilerASTLine,
	context: CompilationContext,
	stackEffect: StackMutationSpec
): InstructionAnalysisResult {
	const consumed = consume(context, resolveStackConsumeCount(line, context, stackEffect.consumes));
	const produced = (stackEffect.produces ?? []).map(producedSpec => resolveStackProducedItem(consumed, producedSpec));

	produce(context, produced);

	return {
		consumed,
		produced,
		...(stackEffect.dropped === 'consumed' ? { dropped: consumed } : {}),
	};
}

/**
 * Applies stack-analysis behavior declared in the central instruction spec when available.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @param spec - Instruction specification that drives the operation.
 * @returns Stack-analysis result for the from spec instruction.
 */
export function analyzeFromSpec(
	line: CompilerASTLine,
	context: CompilationContext,
	spec: InstructionSpec | undefined
): InstructionAnalysisResult | undefined {
	const effects = spec?.effects;
	if (effects?.blockClose) {
		return analyzeExpectedBlockResult(line, context, {
			restore: effects.blockClose.restoreResult,
		});
	}

	if (spec?.stack?.effect) {
		return analyzeStackEffectFromSpec(line, context, spec.stack.effect);
	}

	return undefined;
}
