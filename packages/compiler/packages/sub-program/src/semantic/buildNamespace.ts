import { getError } from '@8f4e/compiler-diagnostics';
import {
	type ComposedFunctionAST,
	createFunctionId,
	DEFAULT_HOST_IMPORT_MODULE_NAME,
	ErrorCode,
	type FunctionImportMetadata,
	type FunctionMetadata,
	type FunctionMetadataLookup,
	type FunctionRegistry,
	type FunctionSignature,
	type FunctionValueType,
	MAX_FUNCTION_PARAMETERS,
	MAX_FUNCTION_RETURN_VALUES,
	type RegisteredFunction,
} from '@8f4e/language-spec';

/** Inputs for registering function metadata and validating whole-program function names. */
type FunctionRegistrationOptions = {
	reservedFunctionIds: readonly string[];
	reservedExportNames: readonly string[];
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

/** Gets the declared signature and checks the compiler's function arity limits. */
function getFunctionSignature(ast: ComposedFunctionAST): FunctionSignature {
	const parameters: FunctionSignature['parameters'] = [];
	for (const line of ast.lines) {
		if (line.instruction !== 'param') continue;
		parameters.push({ name: line.arguments[1].value, type: line.arguments[0].value as FunctionValueType });
		if (parameters.length > MAX_FUNCTION_PARAMETERS) {
			throw getError(ErrorCode.FUNCTION_SIGNATURE_OVERFLOW, line, { symbol: ast.name });
		}
	}
	if (ast.functionEndLine.arguments.length > MAX_FUNCTION_RETURN_VALUES) {
		throw getError(ErrorCode.FUNCTION_SIGNATURE_OVERFLOW, ast.functionEndLine, { symbol: ast.name });
	}

	return {
		parameters,
		returns: ast.functionEndLine.arguments.map(argument => argument.value as FunctionSignature['returns'][number]),
	};
}

/**
 * Selects the last declaration of each parameter signature and registers its metadata for later compiler stages.
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
	const selectedFunctions = new Map<string, { id: string; ast: TFunction; signature: FunctionSignature }>();
	for (const ast of asts) {
		const signature = getFunctionSignature(ast);
		const parameters = signature.parameters.map(parameter => parameter.type);
		const id = createFunctionId(ast.name, parameters);
		const key = JSON.stringify([ast.name, parameters]);
		// Keep the selected declarations in their own source order.
		selectedFunctions.delete(key);
		selectedFunctions.set(key, { id, ast, signature });
	}
	const overloadCountsByName = [...selectedFunctions.values()].reduce<Record<string, number>>((counts, { ast }) => {
		counts[ast.name] = (counts[ast.name] ?? 0) + 1;
		return counts;
	}, Object.create(null));
	const seenFunctionIds = new Set(options.reservedFunctionIds);
	const reservedFunctionNames = new Set(options.reservedFunctionIds);
	const seenExportNames = new Set(options.reservedExportNames);

	for (const { id, ast, signature } of selectedFunctions.values()) {
		const name = ast.name;
		if (reservedFunctionNames.has(name)) {
			throw getError(ErrorCode.DUPLICATE_IDENTIFIER, ast.functionLine, {
				details: {
					identifier: name,
				},
			});
		}
		if (seenFunctionIds.has(id)) {
			throw getError(ErrorCode.DUPLICATE_FUNCTION_SIGNATURE, ast.functionLine, {
				details: { identifier: id },
			});
		}
		const existingArity = arityByName[name];
		const arity = signature.parameters.length;
		if (existingArity !== undefined) {
			if (existingArity === 0 || arity === 0 || existingArity !== arity) {
				throw getError(ErrorCode.INVALID_FUNCTION_OVERLOAD_SET, ast.functionLine, {
					details: {
						identifier: name,
					},
				});
			}
		}

		const importedFunction = getFunctionImportMetadata(ast);
		const exportName = getFunctionExportName(ast);
		if (exportName && overloadCountsByName[name] > 1) {
			throw getError(ErrorCode.OVERLOADED_FUNCTION_EXPORT_UNSUPPORTED, ast.exportLine ?? ast.functionLine, {
				details: {
					identifier: name,
				},
			});
		}
		if (exportName) {
			if (seenExportNames.has(exportName)) {
				throw getError(ErrorCode.DUPLICATE_EXPORT_NAME, ast.exportLine ?? ast.functionLine, {
					details: {
						identifier: exportName,
					},
				});
			}
			seenExportNames.add(exportName);
		}

		const metadata: FunctionMetadata = {
			id,
			name,
			signature,
			...(importedFunction ? { import: importedFunction } : {}),
			...(exportName ? { exportName } : {}),
			...(importedFunction || ast.lines.some(line => line.instruction === '#impure') ? { isImpure: true } : {}),
		};
		seenFunctionIds.add(id);
		byId[id] = metadata;
		arityByName[name] = arity;
		declarations.push({ ast, metadata });
	}

	return { registry: { byId, arityByName }, declarations };
}
