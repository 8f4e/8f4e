import unsignedLEB128 from '../encoding/unsignedLEB128';
import type { FunctionType } from '../section';
import type { WasmTypeValue } from '../type';

/**
 * Creates a WebAssembly function type signature (param types → result types).
 *
 * @param parameterTypes - Array of parameter types
 * @param resultTypes - Array of result types (defaults to empty)
 * @returns Byte array representing the function type
 */
export default function createFunctionType(
	parameterTypes: WasmTypeValue[],
	resultTypes: WasmTypeValue[] = []
): FunctionType {
	const numberOfParameters = parameterTypes.length;
	const numberOfResults = resultTypes.length;

	return [
		0x60,
		...unsignedLEB128(numberOfParameters),
		...parameterTypes,
		...unsignedLEB128(numberOfResults),
		...resultTypes,
	];
}
