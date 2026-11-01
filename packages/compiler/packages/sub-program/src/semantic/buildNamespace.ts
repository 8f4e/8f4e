import {
	type CompilerDiagnosticContext,
	type ComposedFunctionAST,
	createFunctionId,
	DEFAULT_HOST_IMPORT_MODULE_NAME,
	ErrorCode,
	type FunctionImportMetadata,
	type FunctionMetadata,
	type FunctionMetadataLookup,
	type FunctionRegistry,
	getEffectiveFunctionMetadata,
	getError,
	type RegisteredFunction,
	type ValidatedModuleAST,
	type ValidatedPrototypeAST,
} from '@8f4e/language-spec';

function getAstDiagnosticContext(
	ast: ComposedFunctionAST | ValidatedModuleAST | ValidatedPrototypeAST
): CompilerDiagnosticContext {
	return {
		codeBlockType: ast.type,
		...(ast.projectBlockId !== undefined ? { projectBlockId: ast.projectBlockId } : {}),
	};
}

/** Inputs for registering function metadata and validating whole-program function names. */
type FunctionRegistrationOptions = {
	reservedFunctionIds: readonly string[];
	reservedExportNames: readonly string[];
	prototypeShapes: Readonly<Record<string, ValidatedPrototypeAST>>;
};

interface FunctionRegistration<TFunction extends ComposedFunctionAST> {
	registry: FunctionRegistry;
	declarations: RegisteredFunction<TFunction>[];
}

function getFunctionImportMetadata(ast: ComposedFunctionAST): FunctionImportMetadata | undefined {
	if (!ast.importLine) {
		return undefined;
	}

	return {
		moduleName: DEFAULT_HOST_IMPORT_MODULE_NAME,
		fieldName: ast.importLine.arguments[0].value,
	};
}

function getFunctionExportName(ast: ComposedFunctionAST): string | undefined {
	return ast.exportLine ? (ast.exportLine.arguments[0]?.value ?? ast.name) : undefined;
}

/**
 * Registers function declarations and resolves their metadata once for later compiler stages.
 * This allows semantic reference resolution (e.g. `call` target validation) and
 * function-body codegen to rely on the same registry before full function
 * compilation completes.
 *
 * @param asts - Validated ASTs being processed.
 * @param options - Compiler options for this compilation pass.
 * @returns The computed result.
 */
export function registerFunctions<TFunction extends ComposedFunctionAST>(
	asts: readonly TFunction[],
	options: FunctionRegistrationOptions
): FunctionRegistration<TFunction> {
	const declarations: RegisteredFunction<TFunction>[] = [];
	const byId: FunctionMetadataLookup = {};
	// Source names may also be Object.prototype property names.
	const arityByName: FunctionRegistry['arityByName'] = Object.create(null);
	const overloadCountsByName = asts.reduce<Record<string, number>>((counts, ast) => {
		counts[ast.name] = (counts[ast.name] ?? 0) + 1;
		return counts;
	}, Object.create(null));
	const seenFunctionIds = new Set(options.reservedFunctionIds);
	const reservedFunctionNames = new Set(options.reservedFunctionIds);
	const seenExportNames = new Set(options.reservedExportNames);

	for (const ast of asts) {
		const name = ast.name;
		const functionMetadata = getEffectiveFunctionMetadata(ast, options.prototypeShapes);
		const id = createFunctionId(
			name,
			functionMetadata.signature.parameters.map(parameter => parameter.type)
		);
		if (reservedFunctionNames.has(name)) {
			throw getError(ErrorCode.DUPLICATE_IDENTIFIER, ast.functionLine, getAstDiagnosticContext(ast), {
				identifier: name,
			});
		}
		if (seenFunctionIds.has(id)) {
			throw getError(ErrorCode.DUPLICATE_FUNCTION_SIGNATURE, ast.functionLine, getAstDiagnosticContext(ast), {
				identifier: id,
			});
		}

		const existingArity = arityByName[name];
		const arity = functionMetadata.signature.parameters.length;
		if (existingArity !== undefined) {
			if (existingArity === 0 || arity === 0 || existingArity !== arity) {
				throw getError(ErrorCode.INVALID_FUNCTION_OVERLOAD_SET, ast.functionLine, getAstDiagnosticContext(ast), {
					identifier: name,
				});
			}
		}

		const importedFunction = getFunctionImportMetadata(ast);
		const exportName = getFunctionExportName(ast);
		if (exportName && overloadCountsByName[name] > 1) {
			throw getError(
				ErrorCode.OVERLOADED_FUNCTION_EXPORT_UNSUPPORTED,
				ast.exportLine ?? ast.functionLine,
				getAstDiagnosticContext(ast),
				{
					identifier: name,
				}
			);
		}
		if (exportName) {
			if (seenExportNames.has(exportName)) {
				throw getError(
					ErrorCode.DUPLICATE_EXPORT_NAME,
					ast.exportLine ?? ast.functionLine,
					getAstDiagnosticContext(ast),
					{
						identifier: exportName,
					}
				);
			}
			seenExportNames.add(exportName);
		}

		const metadata: FunctionMetadata = {
			id,
			name,
			signature: functionMetadata.signature,
			...(importedFunction ? { import: importedFunction } : {}),
			...(exportName ? { exportName } : {}),
			...(importedFunction || ast.lines.some(line => line.instruction === '#impure') ? { isImpure: true } : {}),
			...(functionMetadata.paramShapeExpansions ? { paramShapeExpansions: functionMetadata.paramShapeExpansions } : {}),
		};
		seenFunctionIds.add(id);
		byId[id] = metadata;
		arityByName[name] = arity;
		declarations.push({ ast, metadata });
	}

	return { registry: { byId, arityByName }, declarations };
}

/**
 * Ensures module source blocks declare unique ids before namespace discovery.
 *
 * @param asts - Validated ASTs being processed.
 * @returns Nothing.
 */
export function assertUniqueModuleIds(asts: readonly ValidatedModuleAST[]): void {
	const seenModuleIds = new Set<string>();

	for (const ast of asts) {
		const id = ast.id;
		if (seenModuleIds.has(id)) {
			throw getError(ErrorCode.DUPLICATE_IDENTIFIER, ast.moduleLine, getAstDiagnosticContext(ast), { identifier: id });
		}
		seenModuleIds.add(id);
	}
}
