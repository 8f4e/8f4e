import { ArgumentType } from './arguments';
import type { CompilerASTLine, FunctionAST, MemoryDeclarationLine, ParamShapeLine, PrototypeAST } from './ast';
import { isMemoryDeclarationLine } from './ast';
import type { FunctionMetadata, FunctionParamShapeExpansion } from './compiled';
import { ErrorCode, getError } from './compilerError';
import type { CompilerDiagnosticContext } from './diagnostics';
import type { FunctionValueType } from './functionTypes';
import { isFunctionValueType, MAX_FUNCTION_PARAMETERS, MAX_FUNCTION_RETURN_VALUES } from './functionTypes';

function getAstDiagnosticContext(ast: FunctionAST): CompilerDiagnosticContext {
	return {
		codeBlockType: ast.type,
		codeBlockId: ast.name,
		...(ast.projectBlockId !== undefined ? { projectBlockId: ast.projectBlockId } : {}),
	};
}

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
	context: CompilerDiagnosticContext
): string {
	const idArgument = line.arguments[0];
	if (idArgument.type !== ArgumentType.IDENTIFIER || idArgument.referenceKind !== 'plain') {
		throw getError(ErrorCode.EXPECTED_IDENTIFIER, sourceLine, context);
	}

	return idArgument.value;
}

export function getParamType(
	line: MemoryDeclarationLine,
	sourceLine: CompilerASTLine,
	context: CompilerDiagnosticContext
): FunctionValueType {
	const declarationType = line.instruction.endsWith('[]') ? line.instruction.slice(0, -2) : line.instruction;
	const normalizedType = declarationType === 'int32' ? 'int' : declarationType;
	const pointerDepth = getPointerDepth(normalizedType);
	const expandedPointerDepth = pointerDepth + 1;

	if (expandedPointerDepth > 2) {
		throw getError(ErrorCode.PARAM_SHAPE_UNSUPPORTED_POINTER_DEPTH, sourceLine, context);
	}

	const baseType = normalizedType.replace(/\*+$/, '');
	const paramType = `${baseType}${'*'.repeat(expandedPointerDepth)}`;
	if (!isFunctionValueType(paramType)) {
		throw getError(ErrorCode.PARAM_SHAPE_UNSUPPORTED_POINTER_DEPTH, sourceLine, context);
	}

	return paramType;
}

function getParamShapeExpansion(
	line: ParamShapeLine,
	prototypeShapes: Readonly<Record<string, PrototypeAST>>,
	context: CompilerDiagnosticContext
): FunctionParamShapeExpansion {
	const prototypeId = line.arguments[0].value;
	const prototype = prototypeShapes[prototypeId];
	if (!prototype) {
		throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, context, { identifier: prototypeId });
	}

	return {
		lineNumber: line.lineNumber,
		parameters: prototype.lines.filter(isMemoryDeclarationLine).map(declarationLine => ({
			type: getParamType(declarationLine, line, context),
			name: getPrototypeMemoryDeclarationId(declarationLine, line, context),
		})),
	};
}

export function getEffectiveFunctionMetadata(
	ast: FunctionAST,
	prototypeShapes: Readonly<Record<string, PrototypeAST>>
): Pick<FunctionMetadata, 'signature' | 'paramShapeExpansions'> {
	const parameters: FunctionMetadata['signature']['parameters'] = [];
	const paramShapeExpansions: FunctionParamShapeExpansion[] = [];
	const context = getAstDiagnosticContext(ast);

	for (const line of ast.lines) {
		if (line.instruction === 'param') {
			parameters.push({ name: line.arguments[1].value, type: line.arguments[0].value as FunctionValueType });
		}
		if (line.instruction === 'paramShape') {
			const expansion = getParamShapeExpansion(line, prototypeShapes, context);
			paramShapeExpansions.push(expansion);
			parameters.push(...expansion.parameters);
		}
		if (parameters.length > MAX_FUNCTION_PARAMETERS)
			throw getError(ErrorCode.FUNCTION_SIGNATURE_OVERFLOW, line, context);
	}
	if (ast.functionEndLine.arguments.length > MAX_FUNCTION_RETURN_VALUES) {
		throw getError(ErrorCode.FUNCTION_SIGNATURE_OVERFLOW, ast.functionEndLine, context);
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
