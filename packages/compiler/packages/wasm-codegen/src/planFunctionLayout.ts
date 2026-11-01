import type {
	AssertionImport,
	ComposedFunctionAST,
	ComposedModuleAST,
	FunctionTypeRegistry,
	WasmFunctionImport,
	WasmFunctionLayout,
	WasmFunctionMetadata,
} from '@8f4e/language-spec';
import { createFunctionId } from '@8f4e/language-spec';
import type { SemanticReferenceReport } from '@8f4e/semantic-reference-resolver';
import { functionValueTypeToWasmType } from './functionValueType';
import { getOrRegisterFunctionType } from './instructionCompilers/utils/functionTypeRegistry';

/** Assigns all function indices once, after symbols, operands, and callback signatures are known. */
export function planFunctionLayout(
	references: SemanticReferenceReport<ComposedModuleAST, ComposedFunctionAST>,
	entryNames: readonly string[],
	assertionImports: readonly AssertionImport[],
	types: FunctionTypeRegistry
): WasmFunctionLayout {
	const imports: WasmFunctionImport[] = [];
	const functionMetadata: Record<string, WasmFunctionMetadata> = {};
	const moduleFunctionIndices: Record<string, number> = {};
	const assertionCallbacks = new Map<AssertionImport['fieldName'], number>();
	const functions = Object.values(references.functions);
	const typeIndices = new Map(
		functions.map(({ metadata }) => [
			metadata.id,
			getOrRegisterFunctionType(types, {
				params: metadata.signature.parameters.map(parameter => functionValueTypeToWasmType(parameter.type)),
				results: metadata.signature.returns.map(functionValueTypeToWasmType),
			}),
		])
	);
	for (const { metadata } of functions) {
		if (!metadata.import) continue;
		const typeIndex = typeIndices.get(metadata.id)!;
		functionMetadata[metadata.id] = { wasmIndex: imports.length, typeIndex };
		imports.push({ ...metadata.import, typeIndex });
	}
	for (const imported of assertionImports) {
		assertionCallbacks.set(imported.fieldName, imports.length);
		imports.push({
			moduleName: imported.moduleName,
			fieldName: imported.fieldName,
			typeIndex: getOrRegisterFunctionType(types, imported.signature),
		});
	}
	const initDefaultsIndex = imports.length;
	let nextIndex = initDefaultsIndex + 1;
	for (const name of entryNames) {
		functionMetadata[createFunctionId(name, [])] = { wasmIndex: nextIndex++, typeIndex: 0 };
	}
	for (const { metadata } of functions) {
		if (!metadata.import) {
			functionMetadata[metadata.id] = { wasmIndex: nextIndex++, typeIndex: typeIndices.get(metadata.id)! };
		}
	}
	for (const { ast } of Object.values(references.modules)) {
		moduleFunctionIndices[ast.id] = nextIndex++;
	}
	return { imports, functions: functionMetadata, assertionCallbacks, initDefaultsIndex, moduleFunctionIndices };
}
