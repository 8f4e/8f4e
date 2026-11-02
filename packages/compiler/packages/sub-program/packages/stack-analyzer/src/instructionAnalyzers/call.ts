import type {
	CompilationContext,
	FunctionMetadata,
	FunctionValueType,
	SemanticCallLine,
	Stack,
	StackItem,
} from '@8f4e/language-spec';
import {
	createFunctionId,
	ErrorCode,
	functionValueTypeToStackItem,
	getError,
	stackItemToFunctionValueType,
} from '@8f4e/language-spec';
import { consume, produce } from './stack';

function stackItemsToFunctionId(functionName: string, stackItems: readonly StackItem[]): string {
	return createFunctionId(functionName, stackItems.map(stackItemToFunctionValueType));
}

function formatFunctionCallSignature(functionName: string, parameters: readonly FunctionValueType[]): string {
	return `${functionName}(${parameters.join(', ')})`;
}

function resolveTargetFunction(line: SemanticCallLine, context: CompilationContext): FunctionMetadata {
	const functionName = line.arguments[0].value;
	const functionRegistry = context.namespace.functions!;
	const arity = functionRegistry.arityByName[functionName]!;

	if (context.stack.length < arity) {
		throw getError(ErrorCode.INSUFFICIENT_OPERANDS, line, context);
	}

	const operands = context.stack.slice(context.stack.length - arity);
	const exactMatch = functionRegistry.byId[stackItemsToFunctionId(functionName, operands)];
	if (exactMatch) {
		return exactMatch;
	}

	const inferredParameterTypes = operands.map(stackItemToFunctionValueType);
	const availableOverloadSignatures = Object.values(functionRegistry.byId)
		.filter(functionMetadata => functionMetadata.name === functionName)
		.map(functionMetadata =>
			formatFunctionCallSignature(
				functionName,
				functionMetadata.signature.parameters.map(parameter => parameter.type)
			)
		)
		.sort((left, right) => left.localeCompare(right));

	throw getError(ErrorCode.FUNCTION_OVERLOAD_NO_MATCH, line, context, {
		identifier: functionName,
		inferredCallSignature: formatFunctionCallSignature(functionName, inferredParameterTypes),
		availableOverloadSignatures,
	});
}

/**
 * Applies function-call stack effects after validating arguments against the resolved target signature.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The relevant stack items for the analysis step.
 */
export function analyzeCall(
	line: SemanticCallLine,
	context: CompilationContext
): { consumed: Stack; produced: Stack; targetFunctionId: string } {
	const targetFunction = resolveTargetFunction(line, context);
	const { parameters, returns } = targetFunction.signature;

	const consumed = consume(context, parameters.length);
	const produced = returns.map(returnType => functionValueTypeToStackItem(returnType));
	produce(context, produced);
	return { consumed, produced, targetFunctionId: targetFunction.id };
}
