import { getError } from '@8f4e/compiler-diagnostics';
import type {
	CompilerASTLine,
	FunctionAST,
	FunctionMetadata,
	FunctionParamShapeExpansion,
	FunctionValueType,
	MemoryDeclarationLine,
	ParamShapeLine,
	PrototypeAST,
} from '@8f4e/language-spec';
import {
	ArgumentType,
	ErrorCode,
	isFunctionValueType,
	isMemoryDeclarationLine,
	MAX_FUNCTION_PARAMETERS,
	MAX_FUNCTION_RETURN_VALUES,
} from '@8f4e/language-spec';

function getPointerDepth(type: string): number {
	if (type.endsWith('**')) {
		return 2;
	}
	if (type.endsWith('*')) {
		return 1;
	}
	return 0;
}

export function getPrototypeMemoryDeclarationId(
	line: MemoryDeclarationLine,
	sourceLine: CompilerASTLine,
	symbol: string | undefined
): string {
	const idArgument = line.arguments[0];
	if (idArgument.type !== ArgumentType.IDENTIFIER || idArgument.referenceKind !== 'plain') {
		throw getError(ErrorCode.EXPECTED_IDENTIFIER, sourceLine, { symbol });
	}

	return idArgument.value;
}

export function getParamType(
	line: MemoryDeclarationLine,
	sourceLine: CompilerASTLine,
	symbol: string | undefined
): FunctionValueType {
	const declarationType = line.instruction.endsWith('[]') ? line.instruction.slice(0, -2) : line.instruction;
	const normalizedType = declarationType === 'int32' ? 'int' : declarationType;
	const pointerDepth = getPointerDepth(normalizedType);
	const expandedPointerDepth = pointerDepth + 1;

	if (expandedPointerDepth > 2) {
		throw getError(ErrorCode.PARAM_SHAPE_UNSUPPORTED_POINTER_DEPTH, sourceLine, { symbol });
	}

	const baseType = normalizedType.replace(/\*+$/, '');
	const paramType = `${baseType}${'*'.repeat(expandedPointerDepth)}`;
	if (!isFunctionValueType(paramType)) {
		throw getError(ErrorCode.PARAM_SHAPE_UNSUPPORTED_POINTER_DEPTH, sourceLine, { symbol });
	}

	return paramType;
}

function getParamShapeExpansion(
	line: ParamShapeLine,
	prototypeShapes: Readonly<Record<string, PrototypeAST>>,
	symbol: string | undefined
): FunctionParamShapeExpansion {
	const prototypeId = line.arguments[0].value;
	const prototype = prototypeShapes[prototypeId];
	if (!prototype) {
		throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, { symbol, details: { identifier: prototypeId } });
	}

	return {
		lineNumber: line.lineNumber,
		parameters: prototype.lines.filter(isMemoryDeclarationLine).map(declarationLine => ({
			type: getParamType(declarationLine, line, symbol),
			name: getPrototypeMemoryDeclarationId(declarationLine, line, symbol),
		})),
	};
}

export function getEffectiveFunctionMetadata(
	ast: FunctionAST,
	prototypeShapes: Readonly<Record<string, PrototypeAST>>
): Pick<FunctionMetadata, 'signature' | 'paramShapeExpansions'> {
	const parameters: FunctionMetadata['signature']['parameters'] = [];
	const paramShapeExpansions: FunctionParamShapeExpansion[] = [];
	const symbol = ast.name;

	for (const line of ast.lines) {
		if (line.instruction === 'param') {
			parameters.push({ name: line.arguments[1].value, type: line.arguments[0].value as FunctionValueType });
		}
		if (line.instruction === 'paramShape') {
			const expansion = getParamShapeExpansion(line, prototypeShapes, symbol);
			paramShapeExpansions.push(expansion);
			parameters.push(...expansion.parameters);
		}
		if (parameters.length > MAX_FUNCTION_PARAMETERS)
			throw getError(ErrorCode.FUNCTION_SIGNATURE_OVERFLOW, line, { symbol });
	}
	if (ast.functionEndLine.arguments.length > MAX_FUNCTION_RETURN_VALUES) {
		throw getError(ErrorCode.FUNCTION_SIGNATURE_OVERFLOW, ast.functionEndLine, { symbol });
	}

	return {
		signature: {
			parameters,
			returns: ast.functionEndLine.arguments.map(
				argument => argument.value as FunctionMetadata['signature']['returns'][number]
			),
		},
		...(paramShapeExpansions.length > 0 ? { paramShapeExpansions } : {}),
	};
}
