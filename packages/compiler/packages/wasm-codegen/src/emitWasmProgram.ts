import {
	createCodeSection,
	createDataCountSection,
	createDataSection,
	createExportSection,
	createFunction,
	createFunctionExport,
	createFunctionImport,
	createFunctionSection,
	createImportSection,
	createLocalDeclaration,
	createMemoryImport,
	createPassiveDataSegment,
	createTypeSection,
	createWasmVersion,
	WASM_HEADER,
} from '@8f4e/compiler-wasm-utils';
import type { FunctionTypeRegistry, WasmIR } from '@8f4e/language-spec';
import { emitWasmInstructions } from './emitWasmInstructions';
import { getOrRegisterFunctionType } from './functionTypeRegistry';

/** Assigns indices and serializes an already lowered Wasm module. */
export function emitWasmProgram(program: WasmIR): Uint8Array {
	const types: FunctionTypeRegistry = { types: [], signatures: [], baseTypeIndex: 0 };
	const functions = [...program.functions];
	const imports = functions.filter(([, func]) => func.import !== undefined);
	const definitions = functions.filter(([, func]) => func.body !== undefined);
	const functionIndices = new Map([...imports, ...definitions].map(([id], index) => [id, index]));
	const typeIndices = new Map(functions.map(([id, func]) => [id, getOrRegisterFunctionType(types, func.signature)]));
	const dataIndices = new Map([...program.dataSegments.keys()].map((id, index) => [id, index]));
	const bodies = definitions.map(([, func]) =>
		createFunction(
			func.body!.locals.slice(func.signature.params.length).map(type => createLocalDeclaration(type, 1)),
			emitWasmInstructions(func.body!.instructions, functionIndices, dataIndices, types)
		)
	);
	const memory = program.memory;
	const dataSegments = [...program.dataSegments.values()].map(createPassiveDataSegment);
	return Uint8Array.from([
		...WASM_HEADER,
		...createWasmVersion(1),
		...createTypeSection(types.types),
		...createImportSection([
			...imports.map(([id, func]) =>
				createFunctionImport(func.import!.moduleName, func.import!.fieldName, typeIndices.get(id)!)
			),
			createMemoryImport(memory.moduleName, memory.fieldName, memory.minPages, memory.maxPages),
		]),
		...createFunctionSection(definitions.map(([id]) => typeIndices.get(id)!)),
		...createExportSection(
			[...program.exports].map(([name, id]) => createFunctionExport(name, functionIndices.get(id)!))
		),
		...(dataSegments.length ? createDataCountSection(dataSegments.length) : []),
		...createCodeSection(bodies),
		...(dataSegments.length ? createDataSection(dataSegments) : []),
	]);
}
