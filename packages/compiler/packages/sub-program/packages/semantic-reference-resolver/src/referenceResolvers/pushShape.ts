import { getError } from '@8f4e/compiler-diagnostics';
import {
	ArgumentType,
	type CodegenPushLine,
	ErrorCode,
	isMemoryDeclarationLine,
	memoryStartAddressValue,
	type PushShapeLine,
	type ResolvedPushShapeLine,
} from '@8f4e/language-spec';
import { getParamType, getPrototypeMemoryDeclarationId, getResolvedMemoryDeclaration } from '@8f4e/semantic-utils';
import type { ReferenceResolutionContext } from '../context';

function createAddressPushLine(
	line: PushShapeLine,
	memoryId: string,
	context: ReferenceResolutionContext
): CodegenPushLine {
	const address = memoryStartAddressValue(
		getResolvedMemoryDeclaration(context, memoryId)!,
		context.namespace.moduleName
	);

	return {
		diagnosticSource: line.diagnosticSource,
		lineNumber: line.lineNumber,
		instruction: 'push',
		arguments: [
			{
				type: ArgumentType.LITERAL,
				value: address.value,
				isInteger: address.isInteger,
				...(address.address ? { address: address.address } : {}),
			},
		],
	};
}

/**
 * Resolves `pushShape` into the explicit address pushes for the current module's effective shape memory.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Resolved pushShape line with codegen-ready address pushes.
 */
export default function resolvePushShapeReferences(
	line: PushShapeLine,
	context: ReferenceResolutionContext
): ResolvedPushShapeLine {
	const prototypeId = line.arguments[0].value;
	const prototype = context.prototypeShapes?.[prototypeId];
	if (!prototype) {
		throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
			symbol: context.codeBlockId,
			details: { identifier: prototypeId },
		});
	}

	if (!context.namespace.prototypeShapeIds.includes(prototypeId)) {
		throw getError(ErrorCode.PUSH_SHAPE_REQUIRES_MODULE_SHAPE, line, {
			symbol: context.codeBlockId,
			details: { identifier: prototypeId },
		});
	}

	return {
		...line,
		shapeExpansions: prototype.lines.filter(isMemoryDeclarationLine).map(declarationLine => ({
			pushLine: createAddressPushLine(
				line,
				getPrototypeMemoryDeclarationId(declarationLine, line, context.codeBlockId),
				context
			),
			pointerType: getParamType(declarationLine, line, context.codeBlockId),
		})),
	};
}
