import type { FunctionMetadata, ValidatedFunctionAST } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { compileToAST } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { resolveSemanticReferences } from '../src';

function resolveFunction(body: string[], isImpure = false) {
	const ast = compileToAST([
		'function caller',
		...(isImpure ? ['#impure'] : []),
		'param int* pointer',
		...body,
		'functionEnd',
	]) as ValidatedFunctionAST;
	const metadata: FunctionMetadata = {
		id: 'caller__int_p',
		name: 'caller',
		signature: { parameters: [{ name: 'value', type: 'int*' }], returns: [] },
		...(isImpure ? { isImpure: true } : {}),
	};
	const consumer: FunctionMetadata = {
		id: 'consume__int',
		name: 'consume',
		signature: { parameters: [{ name: 'value', type: 'int' }], returns: [] },
	};

	return resolveSemanticReferences({
		ast: { prototypes: [], modules: [], constants: [] },
		registeredFunctions: [{ ast, metadata }],
		memoryPlan: { modules: {}, moduleList: [] },
		memoryAliases: new Map(),
		pointerMetadataByModuleId: {},
		constantReferences: { prototypes: [], modules: [], constants: [], functions: [{ lineFacts: [] }] },
		memoryReferences: {
			prototypes: [],
			modules: [],
			constants: [],
			functions: [{ lineFacts: [] }],
			declarationSourcesByModuleId: {},
			pointerMetadataByModuleId: {},
		},
		functions: {
			byId: { [metadata.id]: metadata, [consumer.id]: consumer },
			arityByName: { caller: 1, consume: 1 },
		},
		functionTypeRegistry: { types: [], signatures: [], baseTypeIndex: 3 },
		prototypeShapes: {},
	}).references.functions[metadata.id];
}

const memoryIoBodies = [
	...['load', 'load8u', 'load8s', 'load16u', 'load16s', 'loadFloat'].map(instruction => ({
		name: instruction,
		body: ['push pointer', instruction, 'drop'],
	})),
	{ name: 'store', body: ['push pointer', 'push 1', 'store'] },
	{ name: 'storeBytes', body: ['push pointer', 'push "ab"', 'storeBytes 2'] },
	{ name: 'memoryCopy', body: ['push pointer', 'push pointer', 'memoryCopy 4'] },
	{ name: 'pointer dereference', body: ['push *pointer', 'drop'] },
	{ name: 'inline pointer dereference', body: ['call consume *pointer'] },
];

describe('semantic memory IO permissions', () => {
	it.each(memoryIoBodies)('rejects $name in a pure function before stack analysis or codegen', ({ body }) => {
		expect(() => resolveFunction(body)).toThrow(String(ErrorCode.IMPURE_DIRECTIVE_REQUIRED_FOR_MEMORY_IO));
	});

	it.each(memoryIoBodies)('accepts $name in an impure function', ({ body }) => {
		expect(() => resolveFunction(body, true)).not.toThrow();
	});

	it('allows pure functions to pass pointer values without dereferencing them', () => {
		expect(resolveFunction(['push pointer', 'drop']).body).toHaveLength(2);
	});
});
