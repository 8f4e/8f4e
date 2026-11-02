import { type ScalarMemoryDeclarationInstruction, scalarMemoryDeclarationInstructions } from './memory';
import type { LocalBinding, LocalValueMetadata, StackItem } from './semantic';

export type ScalarTypeIdentifier = Exclude<ScalarMemoryDeclarationInstruction, `${string}*`>;
export type PointerFunctionTypeIdentifier = Extract<ScalarMemoryDeclarationInstruction, `${string}*`>;
export type FunctionTypeIdentifier = ScalarTypeIdentifier | PointerFunctionTypeIdentifier;
export type FunctionValueType = FunctionTypeIdentifier;

type PointerFunctionValueType = Extract<FunctionValueType, `${string}*`>;
type PointerFunctionPointeeBaseType = NonNullable<LocalBinding['pointeeBaseType']>;

function isPointerFunctionTypeIdentifier(
	type: ScalarMemoryDeclarationInstruction
): type is PointerFunctionTypeIdentifier {
	return type.endsWith('*');
}

export const SCALAR_TYPE_IDENTIFIERS = scalarMemoryDeclarationInstructions.filter(
	(type): type is ScalarTypeIdentifier => !isPointerFunctionTypeIdentifier(type)
);

export const POINTER_FUNCTION_TYPE_IDENTIFIERS = scalarMemoryDeclarationInstructions.filter(
	isPointerFunctionTypeIdentifier
);

export const FUNCTION_TYPE_IDENTIFIERS = [
	...SCALAR_TYPE_IDENTIFIERS,
	...POINTER_FUNCTION_TYPE_IDENTIFIERS,
] as readonly FunctionTypeIdentifier[];

export const MAX_FUNCTION_PARAMETERS = 16;
export const MAX_FUNCTION_RETURN_VALUES = 8;

const pointerFunctionValueTypes: ReadonlySet<string> = new Set(POINTER_FUNCTION_TYPE_IDENTIFIERS);
const functionValueTypes: ReadonlySet<string> = new Set(FUNCTION_TYPE_IDENTIFIERS);

export function isFunctionValueType(type: string): type is FunctionValueType {
	return functionValueTypes.has(type);
}

export function isPointerFunctionValueType(type: FunctionValueType): type is PointerFunctionValueType {
	return pointerFunctionValueTypes.has(type);
}

function getPointerParts(type: PointerFunctionValueType) {
	const pointerDepth = type.endsWith('**') ? 2 : 1;
	const baseType = type.replace(/\*+$/, '') as PointerFunctionPointeeBaseType;
	return { baseType, pointerDepth };
}

export function functionValueTypeToLocalMetadata(type: FunctionValueType): LocalValueMetadata {
	if (type === 'int') {
		return { isInteger: true };
	}

	if (type === 'float') {
		return { isInteger: false };
	}

	if (type === 'float64') {
		return { isInteger: false, isFloat64: true };
	}

	const { baseType, pointerDepth } = getPointerParts(type);
	return {
		isInteger: true,
		pointeeBaseType: baseType,
		pointerDepth,
	};
}

function localBindingToStackItem(binding: LocalValueMetadata): StackItem {
	if (binding.pointeeBaseType) {
		return {
			kind: 'address',
			valueType: 'int',
			address: {},
			pointsTo: {
				baseType: binding.pointeeBaseType,
				pointerDepth: binding.pointerDepth,
			},
		};
	}

	return {
		kind: 'value',
		valueType: binding.isInteger ? 'int' : binding.isFloat64 ? 'float64' : 'float',
	};
}

export function functionValueTypeToStackItem(type: FunctionValueType): StackItem {
	return localBindingToStackItem(functionValueTypeToLocalMetadata(type));
}

export function stackItemToFunctionValueType(stackItem: StackItem): FunctionValueType {
	if (stackItem.kind === 'address' && stackItem.pointsTo) {
		return `${stackItem.pointsTo.baseType}${'*'.repeat(stackItem.pointsTo.pointerDepth)}` as PointerFunctionValueType;
	}

	return stackItem.valueType;
}

export function stackItemMatchesFunctionValueType(stackItem: StackItem, type: FunctionValueType): boolean {
	return stackItemToFunctionValueType(stackItem) === type;
}

/** Default WebAssembly import module namespace for 8f4e host-provided imports. */
export const DEFAULT_HOST_IMPORT_MODULE_NAME = 'host';

/** A named parameter in declaration order, including expanded prototype fields. */
export interface FunctionParameter {
	name: string;
	type: FunctionValueType;
}

/** Language-level function parameters and return value types. */
export interface FunctionSignature {
	parameters: FunctionParameter[];
	returns: FunctionValueType[];
}

/** WebAssembly host import module/name pair for an imported function. */
export interface FunctionImportMetadata {
	moduleName: string;
	fieldName: string;
}

/**
 * Encodes a language-level function value type for use in generated function ids.
 *
 * @param type - Function value type to encode.
 * @returns Identifier-safe type fragment.
 */
export function encodeFunctionValueType(type: FunctionValueType): string {
	return type.replace(/\*+/g, pointerSuffix => '_p'.repeat(pointerSuffix.length));
}

/**
 * Creates the parameter-signature portion of a generated function id.
 *
 * @param parameters - Function parameter types in source order.
 * @returns Encoded parameter signature, or `void` for zero-parameter functions.
 */
export function createFunctionParameterSignatureKey(parameters: readonly FunctionValueType[]): string {
	return parameters.length === 0 ? 'void' : parameters.map(encodeFunctionValueType).join('__');
}

/**
 * Creates the canonical compiler id for a concrete function signature.
 *
 * @param name - Source-level function name.
 * @param parameters - Function parameter types in source order.
 * @returns Signature-derived compiler function id.
 */
export function createFunctionId(name: string, parameters: readonly FunctionValueType[]): string {
	return `${name}__${createFunctionParameterSignatureKey(parameters)}`;
}
