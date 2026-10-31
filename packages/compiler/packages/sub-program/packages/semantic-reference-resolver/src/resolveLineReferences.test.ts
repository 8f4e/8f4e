import {
	ArgumentType,
	type CompilerASTLine,
	createFunctionId,
	ErrorCode,
	type FunctionMetadata,
	type MemoryLayoutPlan,
	type ValidatedFunctionAST,
} from '@8f4e/language-spec';
import { classifyIdentifier, parseArgument } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { resolveSemanticReferences } from '.';
import type { ReferenceResolutionContext } from './context';
import resolveLineReferences from './resolveLineReferences';

function createSourceMemoryPlan(): MemoryLayoutPlan {
	const buffer = {
		id: 'buffer',
		lineNumber: 1,
		numberOfElements: 4,
		elementWordSize: 4,
		allocationUnitAddress: 0,
		allocationUnitCount: 4,
		byteAddress: 0,
		type: 'int',
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
	} as const;
	const source = {
		id: 'source',
		lineNumber: 1,
		byteAddress: 0,
		allocationUnitCount: 4,
		memory: { buffer },
		declarations: [buffer],
		declarationSources: [],
	};
	return {
		modules: { source },
		moduleList: [source],
	};
}

function createEmptyMemoryPlan(): MemoryLayoutPlan {
	return {
		modules: {},
		moduleList: [],
	};
}

function createClampLine(
	instruction: 'clampAddress' | 'clampModuleAddress' | 'clampGlobalAddress',
	accessByteWidth?: number
): CompilerASTLine {
	return {
		lineNumber: 1,
		instruction,
		arguments:
			accessByteWidth === undefined ? [] : [{ type: ArgumentType.LITERAL, value: accessByteWidth, isInteger: true }],
	} as CompilerASTLine;
}

describe('resolveLineReferences', () => {
	it('keeps pre-resolved push literals unchanged', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [{ type: ArgumentType.LITERAL, value: 8, isInteger: true }],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(resolveLineReferences(line, context)).toEqual(line);
	});

	it('leaves identifier-definition positions unchanged when not resolvable', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'int',
			arguments: [classifyIdentifier('output')],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(resolveLineReferences(line, context)).toEqual(line);
	});

	it('keeps pre-resolved map value arguments unchanged', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'map',
			arguments: [
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 8, isInteger: true },
			],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(resolveLineReferences(line, context)).toEqual(line);
	});

	it('throws when a targeted value expression cannot be resolved', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [parseArgument('2*MISSING')],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(() => resolveLineReferences(line, context)).toThrow();
	});

	it('throws UNDECLARED_IDENTIFIER when a map key argument is an unresolved identifier', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'map',
			arguments: [classifyIdentifier('MISSING_CONST'), { type: ArgumentType.LITERAL, value: 100, isInteger: true }],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER when a map value argument is an unresolved identifier', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'map',
			arguments: [{ type: ArgumentType.LITERAL, value: 1, isInteger: true }, classifyIdentifier('UNRESOLVED')],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER when a default argument is an unresolved identifier', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'default',
			arguments: [classifyIdentifier('MISSING_CONST')],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('resolves push identifier arguments when the identifier is a known local', () => {
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [classifyIdentifier('localVar')],
		};
		const context = {
			namespace: {
				moduleName: 'test',
			},
			locals: { localVar: { isInteger: true } },
			bindingsByName: { localVar: { id: 0, name: 'localVar', type: 'int' } },
		} as unknown as ReferenceResolutionContext;

		expect(resolveLineReferences(line, context)).toEqual({
			...line,
			resolvedTarget: { kind: 'local', binding: { id: 0, name: 'localVar', type: 'int' } },
		});
	});

	it('throws UNDECLARED_IDENTIFIER for push with an identifier not in memory or locals', () => {
		const context = {
			namespace: { moduleName: 'test' },
			memoryPlan: createEmptyMemoryPlan(),
			memoryAliases: new Map(),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [classifyIdentifier('unknownVar')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER for localSet with an undeclared local', () => {
		const context = {
			namespace: { moduleName: 'test' },
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'localSet',
			arguments: [classifyIdentifier('missing')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER for push with undeclared intermodule reference', () => {
		const context = {
			namespace: {
				moduleName: 'test',
			},
			memoryPlan: createEmptyMemoryPlan(),
			memoryAliases: new Map(),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [classifyIdentifier('&otherModule:missingMemory')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER for memory declaration with undeclared intermodule memory reference', () => {
		const context = {
			namespace: {
				moduleName: 'test',
			},
			memoryPlan: createSourceMemoryPlan(),
			memoryAliases: new Map(),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'int',
			arguments: [classifyIdentifier('buffer'), classifyIdentifier('&source:missingBuffer')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('does not strip unresolved intermodule address defaults from memory declarations', () => {
		const context = {
			namespace: {
				moduleName: 'test',
			},
			memoryPlan: createSourceMemoryPlan(),
			memoryAliases: new Map(),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'int',
			arguments: [classifyIdentifier('ptr'), classifyIdentifier('&source:buffer')],
		};

		const result = resolveLineReferences(line, context);
		expect(result.arguments).toHaveLength(2);
		expect(result.arguments[0]).toEqual(classifyIdentifier('ptr'));
		expect(result.arguments[1]).toEqual(classifyIdentifier('&source:buffer'));
	});

	it('validates unresolved intermodule references through group aliases', () => {
		const context = {
			namespace: { moduleName: 'test' },
			memoryPlan: createSourceMemoryPlan(),
			memoryAliases: new Map([['audio', new Map([['level', { targetModuleId: 'source', targetMemoryId: 'buffer' }]])]]),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'int*',
			arguments: [classifyIdentifier('ptr'), classifyIdentifier('&audio:level')],
		};

		const result = resolveLineReferences(line, context);

		expect(result.arguments[1]).toEqual(classifyIdentifier('&audio:level'));
	});

	it('does not strip array declaration element count arguments', () => {
		const context = {
			namespace: {
				moduleName: 'test',
			},
			memoryPlan: createSourceMemoryPlan(),
			memoryAliases: new Map(),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'int[]',
			arguments: [classifyIdentifier('buffer'), classifyIdentifier('&source:buffer')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER for memory declaration with unresolved value-expression default', () => {
		const context = {
			namespace: { moduleName: 'test' },
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'int',
			arguments: [classifyIdentifier('buffer'), parseArgument('2*MISSING')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws when an intermodule address push reaches semantic reference resolution', () => {
		const context = {
			namespace: {
				moduleName: 'test',
			},
			memoryPlan: createSourceMemoryPlan(),
			memoryAliases: new Map(),
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [classifyIdentifier('&source:buffer')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws UNDECLARED_IDENTIFIER for push with &name when memory does not exist', () => {
		const context = {
			namespace: { moduleName: 'test' },
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [classifyIdentifier('&missing')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDECLARED_IDENTIFIER}`);
	});

	it('throws for count(*localPointer) when the pointer has no element count metadata', () => {
		const context = {
			namespace: { moduleName: 'test' },
			memoryPlan: createEmptyMemoryPlan(),
			memoryAliases: new Map(),
			locals: {
				lut: { kind: 'value', valueType: 'int', pointeeBaseType: 'float', pointerDepth: 1 },
			},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [classifyIdentifier('count(*lut)')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.POINTEE_ELEMENT_COUNT_UNKNOWN}`);
	});

	it('throws UNDEFINED_FUNCTION for call with an undeclared function target', () => {
		const context = {
			namespace: {
				moduleName: 'test',
				functions: { byId: {}, arityByName: {} },
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'call',
			arguments: [classifyIdentifier('missingFn')],
		};

		expect(() => resolveLineReferences(line, context)).toThrow(`${ErrorCode.UNDEFINED_FUNCTION}`);
	});

	it('does not throw for call when the target function name is registered', () => {
		const targetFunction = { id: 'knownFn', name: 'knownFn', signature: { parameters: [], returns: [] } };
		const context = {
			namespace: {
				moduleName: 'test',
				functions: {
					byId: { knownFn: targetFunction },
					arityByName: { knownFn: 0 },
				},
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'call',
			arguments: [classifyIdentifier('knownFn')],
		};

		expect(resolveLineReferences(line, context)).toEqual(line);
	});

	it('resolves calls by source function name instead of compiler id', () => {
		const targetFunction = {
			id: 'knownFn__int',
			name: 'knownFn',
			signature: { parameters: ['int'], returns: [] },
		};
		const context = {
			namespace: {
				moduleName: 'test',
				functions: {
					byId: { knownFn__int: targetFunction },
					arityByName: { knownFn: 1 },
				},
			},
			locals: {},
		} as unknown as ReferenceResolutionContext;
		const line: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'call',
			arguments: [classifyIdentifier('knownFn')],
		};

		expect(resolveLineReferences(line, context)).toEqual(line);
	});

	it('rejects zero clamp-address access width', () => {
		const context = {
			namespace: { moduleName: 'test' },
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(() => resolveLineReferences(createClampLine('clampAddress', 0), context)).toThrow(
			expect.objectContaining({ code: ErrorCode.INVALID_ACCESS_WIDTH })
		);
	});

	it('rejects unsupported clamp-address access widths', () => {
		const context = {
			namespace: { moduleName: 'test' },
			locals: {},
		} as unknown as ReferenceResolutionContext;

		expect(() => resolveLineReferences(createClampLine('clampAddress', 3), context)).toThrow(
			expect.objectContaining({ code: ErrorCode.INVALID_ACCESS_WIDTH })
		);
	});
});

describe('resolveSemanticReferences', () => {
	it('resolves function parameter pushes once for the sub-program AST', () => {
		const functionLine: CompilerASTLine = {
			lineNumber: 1,
			instruction: 'function',
			arguments: [classifyIdentifier('echo')],
		};
		const paramLine: CompilerASTLine = {
			lineNumber: 2,
			instruction: 'param',
			arguments: [classifyIdentifier('int'), classifyIdentifier('value')],
		};
		const pushLine: CompilerASTLine = {
			lineNumber: 3,
			instruction: 'push',
			arguments: [classifyIdentifier('value')],
		};
		const functionEndLine: CompilerASTLine = {
			lineNumber: 4,
			instruction: 'functionEnd',
			arguments: [classifyIdentifier('int')],
		};
		const functionId = createFunctionId('echo', ['int']);
		const ast = {
			type: 'function',
			name: 'echo',
			lines: [functionLine, paramLine, pushLine, functionEndLine],
			functionLine,
			functionEndLine,
		} as ValidatedFunctionAST;
		const metadata = {
			id: functionId,
			name: 'echo',
			signature: { parameters: ['int'], returns: ['int'] },
		} satisfies FunctionMetadata;

		const result = resolveSemanticReferences({
			ast: { prototypes: [], modules: [], constants: [] },
			registeredFunctions: [{ ast, metadata }],
			memoryPlan: createEmptyMemoryPlan(),
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
				byId: {
					[functionId]: metadata,
				},
				arityByName: { echo: 1 },
			},
			functionTypeRegistry: { types: [], signatures: [], baseTypeIndex: 3 },
			prototypeShapes: {},
		});

		expect(result.references.functions[functionId].body[0].line).toMatchObject({
			resolvedTarget: {
				kind: 'local',
				binding: { id: 0, name: 'value', type: 'int', parameterIndex: 0 },
			},
		});
	});
});
