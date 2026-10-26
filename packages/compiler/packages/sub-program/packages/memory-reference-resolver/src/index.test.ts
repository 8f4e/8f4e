import { ArgumentType, type ValidatedModuleAST } from '@8f4e/language-spec';
import type { MemoryLayoutPlan, PlannedMemoryDeclaration, PlannedMemoryModule } from '@8f4e/memory-planner';
import { describe, expect, it } from 'vitest';
import { resolveMemoryReferences } from './index';
import {
	type MemoryReferenceResolutionContext,
	resolveMemoryExpressionOperand,
	resolveMetadataTarget,
} from './resolveMemoryExpressionOperand';
import { tryResolveValueArgument } from './tryResolveValueArgument';

const { classifyIdentifier, parseArgument, parseCompileTimeOperand } = await import('@8f4e/tokenizer');

function getAllocatedByteLength(allocationUnitCount: number): number {
	return Math.max(0, allocationUnitCount) * 4;
}

function getEndByteAddress(byteAddress: number, allocationUnitCount: number): number {
	return allocationUnitCount <= 0 ? byteAddress : byteAddress + (allocationUnitCount - 1) * 4;
}

function getEndAddressSafeByteLength(allocationUnitCount: number): number {
	return allocationUnitCount > 0 ? 4 : 0;
}

function createMemoryDeclaration(
	id: string,
	overrides: Partial<PlannedMemoryDeclaration> = {}
): PlannedMemoryDeclaration {
	const declaration = {
		id,
		lineNumber: 0,
		type: 'int',
		numberOfElements: 1,
		elementWordSize: 4,
		allocationUnitAddress: 0,
		allocationUnitCount: 1,
		byteAddress: 0,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};

	return {
		...declaration,
		elementByteLength: declaration.numberOfElements * declaration.elementWordSize,
		allocatedByteLength: getAllocatedByteLength(declaration.allocationUnitCount),
		endByteAddress: getEndByteAddress(declaration.byteAddress, declaration.allocationUnitCount),
		endAddressSafeByteLength: getEndAddressSafeByteLength(declaration.allocationUnitCount),
	} as PlannedMemoryDeclaration;
}

function createPlannedModule(
	id: string,
	memory: Record<string, PlannedMemoryDeclaration>,
	overrides: Partial<PlannedMemoryModule> = {}
): PlannedMemoryModule {
	const module = {
		id,
		lineNumber: 0,
		byteAddress: 24,
		allocationUnitCount: 5,
		memory,
		declarations: Object.values(memory),
		declarationSources: [],
		...overrides,
	};

	return {
		...module,
		allocatedByteLength: getAllocatedByteLength(module.allocationUnitCount),
		endByteAddress: getEndByteAddress(module.byteAddress, module.allocationUnitCount),
		endAddressSafeByteLength: getEndAddressSafeByteLength(module.allocationUnitCount),
	} as PlannedMemoryModule;
}

function createMemoryPlan(moduleList: readonly PlannedMemoryModule[]): MemoryLayoutPlan {
	return {
		modules: Object.fromEntries(moduleList.map(module => [module.id, module])),
		moduleList,
	};
}

function createTestContext(
	currentModule: PlannedMemoryModule,
	overrides: Partial<MemoryReferenceResolutionContext> = {}
): MemoryReferenceResolutionContext {
	return {
		memoryPlan: createMemoryPlan([currentModule]),
		memoryAliases: new Map(),
		currentModule,
		pointerMetadata: {},
		locals: {},
		...overrides,
	} as MemoryReferenceResolutionContext;
}

function withRemoteModules(
	context: MemoryReferenceResolutionContext,
	remoteModules: readonly PlannedMemoryModule[]
): MemoryReferenceResolutionContext {
	const currentModule = context.currentModule;
	return {
		...context,
		memoryPlan: createMemoryPlan([...(currentModule ? [currentModule] : []), ...remoteModules]),
	};
}

function noConstantReferences() {
	return {
		prototypes: [],
		modules: [],
		constants: [],
		functions: [],
	};
}

describe('resolveMemoryReferences', () => {
	it('resolves memory references across a sub-program AST using the memory plan', () => {
		const moduleLine = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [classifyIdentifier('main')],
		};
		const pushLine = {
			lineNumber: 2,
			instruction: 'push',
			arguments: [parseArgument('&buffer+4')],
		};
		const ast = {
			type: 'module',
			id: 'main',
			lines: [moduleLine, pushLine],
			moduleLine,
		} as unknown as ValidatedModuleAST;
		const buffer = createMemoryDeclaration('buffer', {
			lineNumber: 3,
			type: 'int',
			numberOfElements: 4,
			elementWordSize: 4,
			allocationUnitAddress: 4,
			allocationUnitCount: 4,
			byteAddress: 16,
		});
		const memoryPlan = createMemoryPlan([
			createPlannedModule('main', { buffer }, { byteAddress: 16, allocationUnitCount: 4 }),
		]);

		const result = resolveMemoryReferences({
			ast: {
				prototypes: [],
				modules: [ast],
				constants: [],
				functions: [],
			},
			memoryPlan,
			memoryAliases: new Map(),
			projectMemoryInitializerScopes: [],
			constantReferences: noConstantReferences(),
		});

		expect(result.references.modules[0].lineFacts[1]?.arguments?.[0]).toEqual({
			type: ArgumentType.LITERAL,
			value: 20,
			isInteger: true,
			address: {
				safeRange: {
					source: 'memory-start',
					byteAddress: 20,
					safeByteLength: 12,
					moduleId: 'main',
					memoryId: 'buffer',
				},
			},
		});
		expect(ast.lines[1]).toBe(pushLine);
	});

	it.each([0, 1, 4])('preserves a known pointee count of %i from a pointer declaration default', count => {
		const moduleLine = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [classifyIdentifier('main')],
		};
		const samplesLine = {
			lineNumber: 2,
			instruction: 'float[]',
			arguments: [classifyIdentifier('samples'), { type: ArgumentType.LITERAL, value: count, isInteger: true }],
		};
		const pointerLine = {
			lineNumber: 3,
			instruction: 'float*',
			arguments: [classifyIdentifier('ptr'), classifyIdentifier('&samples')],
		};
		const pushLine = {
			lineNumber: 4,
			instruction: 'push',
			arguments: [classifyIdentifier('count(*ptr)')],
		};
		const ast = {
			type: 'module',
			id: 'main',
			lines: [moduleLine, samplesLine, pointerLine, pushLine],
			moduleLine,
		} as unknown as ValidatedModuleAST;
		const samples = createMemoryDeclaration('samples', {
			lineNumber: 2,
			type: 'float',
			numberOfElements: count,
			elementWordSize: 4,
			allocationUnitAddress: 4,
			allocationUnitCount: count,
			byteAddress: 16,
			isInteger: false,
		});
		const ptr = createMemoryDeclaration('ptr', {
			lineNumber: 3,
			type: 'float*',
			allocationUnitAddress: 8,
			byteAddress: 32,
			pointeeBaseType: 'float',
			pointerDepth: 1,
		});
		const memoryPlan = createMemoryPlan([
			createPlannedModule('main', { samples, ptr }, { byteAddress: 16, allocationUnitCount: 5 }),
		]);

		const result = resolveMemoryReferences({
			ast: {
				prototypes: [],
				modules: [ast],
				constants: [],
				functions: [],
			},
			memoryPlan,
			memoryAliases: new Map(),
			projectMemoryInitializerScopes: [],
			constantReferences: noConstantReferences(),
		});

		expect(result.references.modules[0].lineFacts[3]?.arguments?.[0]).toEqual({
			type: ArgumentType.LITERAL,
			value: count,
			isInteger: true,
		});
	});

	it('applies constant facts before resolving memory references', () => {
		const moduleLine = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [classifyIdentifier('main')],
		};
		const pushLine = {
			lineNumber: 2,
			instruction: 'push',
			arguments: [parseArgument('&buffer+OFFSET')],
		};
		const ast = {
			type: 'module',
			id: 'main',
			lines: [moduleLine, pushLine],
			moduleLine,
		} as unknown as ValidatedModuleAST;
		const buffer = createMemoryDeclaration('buffer', {
			lineNumber: 3,
			type: 'int',
			numberOfElements: 4,
			elementWordSize: 4,
			allocationUnitAddress: 4,
			allocationUnitCount: 4,
			byteAddress: 16,
		});
		const memoryPlan = createMemoryPlan([
			createPlannedModule('main', { buffer }, { byteAddress: 16, allocationUnitCount: 4 }),
		]);

		const result = resolveMemoryReferences({
			ast: {
				prototypes: [],
				modules: [ast],
				constants: [],
				functions: [],
			},
			memoryPlan,
			memoryAliases: new Map(),
			projectMemoryInitializerScopes: [],
			constantReferences: {
				prototypes: [],
				modules: [
					{
						lineFacts: [
							undefined,
							{
								arguments: [parseArgument('&buffer+4')],
							},
						],
					},
				],
				constants: [],
				functions: [],
			},
		});

		expect(pushLine.arguments[0]).toEqual(parseArgument('&buffer+OFFSET'));
		expect(result.references.modules[0].lineFacts[1]?.arguments?.[0]).toMatchObject({
			type: ArgumentType.LITERAL,
			value: 20,
		});
	});

	it('resolves group aliases without changing source identifiers', () => {
		const moduleLine = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [classifyIdentifier('consumer')],
		};
		const pointerLine = {
			lineNumber: 2,
			instruction: 'int*',
			arguments: [classifyIdentifier('pointer'), classifyIdentifier('&audio:level')],
		};
		const endAddressLine = {
			lineNumber: 3,
			instruction: 'push',
			arguments: [classifyIdentifier('audio:level&')],
		};
		const countLine = {
			lineNumber: 4,
			instruction: 'push',
			arguments: [classifyIdentifier('count(audio:level)')],
		};
		const expressionLine = {
			lineNumber: 5,
			instruction: 'push',
			arguments: [parseArgument('sizeof(audio:level)+1')],
		};
		const ast = {
			type: 'module',
			id: 'consumer',
			lines: [moduleLine, pointerLine, endAddressLine, countLine, expressionLine],
			moduleLine,
		} as unknown as ValidatedModuleAST;
		const pointer = createMemoryDeclaration('pointer', {
			type: 'int*',
			byteAddress: 16,
			pointeeBaseType: 'int',
			pointerDepth: 1,
		});
		const value = createMemoryDeclaration('value', {
			byteAddress: 64,
			numberOfElements: 8,
			elementWordSize: 4,
			allocationUnitCount: 8,
		});
		const memoryPlan = createMemoryPlan([
			createPlannedModule('consumer', { pointer }, { byteAddress: 16, allocationUnitCount: 1 }),
			createPlannedModule('audio/source', { value }, { byteAddress: 64, allocationUnitCount: 8 }),
		]);
		const memoryAliases = new Map([
			['audio', new Map([['level', { targetModuleId: 'audio/source', targetMemoryId: 'value' }]])],
		]);

		const result = resolveMemoryReferences({
			ast: { prototypes: [], modules: [ast], constants: [], functions: [] },
			memoryPlan,
			memoryAliases,
			projectMemoryInitializerScopes: [],
			constantReferences: noConstantReferences(),
		});

		expect(pointerLine.arguments[1]).toMatchObject({
			value: '&audio:level',
			targetModuleId: 'audio',
			targetMemoryId: 'level',
		});
		expect(result.references.modules[0].lineFacts[1]?.arguments?.[1]).toMatchObject({
			type: ArgumentType.LITERAL,
			value: 64,
			address: { safeRange: { moduleId: 'audio/source', memoryId: 'value' } },
		});
		expect(result.references.modules[0].lineFacts[2]?.arguments?.[0]).toMatchObject({
			type: ArgumentType.LITERAL,
			value: value.endByteAddress,
			address: { safeRange: { moduleId: 'audio/source', memoryId: 'value' } },
		});
		expect(result.references.modules[0].lineFacts[3]?.arguments?.[0]).toMatchObject({
			type: ArgumentType.LITERAL,
			value: 8,
		});
		expect(result.references.modules[0].lineFacts[4]?.arguments?.[0]).toMatchObject({
			type: ArgumentType.LITERAL,
			value: 5,
		});
		expect(result.references.pointerMetadataByModuleId.consumer.pointer).toEqual({
			pointeeElementCount: 8,
		});
	});
});

describe('tryResolveValueArgument', () => {
	const samples = createMemoryDeclaration('samples', {
		byteAddress: 32,
		numberOfElements: 8,
		elementWordSize: 2,
		allocationUnitCount: 4,
	});
	const floatBuf = createMemoryDeclaration('floatBuf', {
		numberOfElements: 4,
		elementWordSize: 4,
		isInteger: false,
		type: 'float',
	});
	const floatPtr = createMemoryDeclaration('floatPtr', {
		numberOfElements: 1,
		elementWordSize: 4,
		isInteger: true,
		pointeeBaseType: 'float',
		pointerDepth: 1,
		type: 'float*',
	});
	const mainModule = createPlannedModule('main', {
		samples,
		floatBuf,
		floatPtr,
	});
	const mockContext = createTestContext(mainModule, {
		pointerMetadata: {
			main: {
				floatPtr: {
					pointeeElementCount: 4,
				},
			},
		},
	});

	it('resolves memory expression operands without resolving constant identifiers', () => {
		expect(resolveMemoryExpressionOperand(parseCompileTimeOperand('sizeof(samples)'), mockContext)).toEqual({
			value: 2,
			isInteger: true,
		});
		expect(resolveMemoryExpressionOperand(parseCompileTimeOperand('SIZE'), mockContext)).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('SIZE'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('SIZE*2'))).toBeUndefined();
	});

	it('resolves sizeof(name) * literal', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(samples)*2'))).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('resolves literal * sizeof(name)', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('123*sizeof(samples)'))).toEqual({
			value: 246,
			isInteger: true,
		});
	});

	it('resolves count(name) * literal', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('count(samples)*2'))).toEqual({
			value: 16,
			isInteger: true,
		});
	});

	it('applies explicit rounding after resolving memory expressions', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('round(count(samples)/3)'))).toEqual({
			value: 3,
			isInteger: true,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('floor(count(samples)/3)'))).toEqual({
			value: 2,
			isInteger: true,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('ceil(sizeof(samples))'))).toEqual({
			value: 2,
			isInteger: true,
		});
	});

	it('resolves local memory metadata queries', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('count(*floatPtr)'))).toEqual({
			value: 4,
			isInteger: true,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(*floatPtr)'))).toEqual({
			value: 4,
			isInteger: true,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('max(*floatPtr)'))).toEqual({
			value: 3.4028234663852886e38,
			isInteger: false,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('min(*floatPtr)'))).toEqual({
			value: -3.4028234663852886e38,
			isInteger: false,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('max(samples)'))).toEqual({
			value: 32767,
			isInteger: true,
		});
		expect(tryResolveValueArgument(mockContext, parseArgument('min(samples)'))).toEqual({
			value: -32768,
			isInteger: true,
		});
	});

	it('returns undefined for unresolved local memory metadata queries', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('count(missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('max(missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('min(missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(*missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('max(*missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('min(*missing)'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('count(*missing)'))).toBeUndefined();
	});

	it('returns undefined for unresolved or chained expressions', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('MISSING'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('SIZE/2/2'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('SIZE*2/2'))).toBeUndefined();
	});

	it('resolves intermodule sizeof expressions', () => {
		const buffer = createMemoryDeclaration('buffer', {
			numberOfElements: 4,
			elementWordSize: 2,
		});
		const intermodularNamespace = withRemoteModules(mockContext, [createPlannedModule('source', { buffer })]);

		expect(tryResolveValueArgument(intermodularNamespace, parseArgument('2*sizeof(source:buffer)'))).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('treats max(*localDoublePointer) as an integer-valued pointer slot even for float pointees', () => {
		const localPointerContext = {
			...mockContext,
			locals: {
				floatPtrPtr: {
					kind: 'value',
					valueType: 'int',
					pointeeBaseType: 'float64',
					pointerDepth: 2,
				},
			},
		} as unknown as MemoryReferenceResolutionContext;

		expect(tryResolveValueArgument(localPointerContext, parseArgument('max(*floatPtrPtr)'))).toEqual({
			value: 2147483647,
			isInteger: true,
		});
		expect(tryResolveValueArgument(localPointerContext, parseArgument('min(*floatPtrPtr)'))).toEqual({
			value: -2147483648,
			isInteger: true,
		});
	});

	it('resolves pointee metadata from local pointer bindings', () => {
		const localPointerContext = {
			...mockContext,
			locals: {
				localFloatPtr: {
					kind: 'value',
					valueType: 'int',
					pointeeBaseType: 'float',
					pointerDepth: 1,
					pointeeElementCount: 7,
				},
			},
		} as unknown as MemoryReferenceResolutionContext;

		expect(tryResolveValueArgument(localPointerContext, parseArgument('count(*localFloatPtr)'))).toEqual({
			value: 7,
			isInteger: true,
		});
		expect(tryResolveValueArgument(localPointerContext, parseArgument('sizeof(*localFloatPtr)'))).toEqual({
			value: 4,
			isInteger: true,
		});
		expect(tryResolveValueArgument(localPointerContext, parseArgument('max(*localFloatPtr)'))).toEqual({
			value: 3.4028234663852886e38,
			isInteger: false,
		});
		expect(tryResolveValueArgument(localPointerContext, parseArgument('min(*localFloatPtr)'))).toEqual({
			value: -3.4028234663852886e38,
			isInteger: false,
		});
	});

	it('does not resolve count(*localPointer) without element count metadata', () => {
		const localPointerContext = {
			...mockContext,
			locals: {
				localFloatPtr: {
					kind: 'value',
					valueType: 'int',
					pointeeBaseType: 'float',
					pointerDepth: 1,
				},
			},
		} as unknown as MemoryReferenceResolutionContext;

		expect(tryResolveValueArgument(localPointerContext, parseArgument('count(*localFloatPtr)'))).toBeUndefined();
		expect(tryResolveValueArgument(localPointerContext, parseArgument('sizeof(*localFloatPtr)'))).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('resolves non-word-sized pointee widths from local pointer bindings', () => {
		const localPointerContext = {
			...mockContext,
			locals: {
				int8Ptr: {
					kind: 'value',
					valueType: 'int',
					pointeeBaseType: 'int8',
					pointerDepth: 1,
				},
				int16Ptr: {
					kind: 'value',
					valueType: 'int',
					pointeeBaseType: 'int16',
					pointerDepth: 1,
				},
				float64Ptr: {
					kind: 'value',
					valueType: 'int',
					pointeeBaseType: 'float64',
					pointerDepth: 1,
				},
			},
		} as unknown as MemoryReferenceResolutionContext;

		expect(tryResolveValueArgument(localPointerContext, parseArgument('sizeof(*int8Ptr)'))).toEqual({
			value: 1,
			isInteger: true,
		});
		expect(tryResolveValueArgument(localPointerContext, parseArgument('sizeof(*int16Ptr)'))).toEqual({
			value: 2,
			isInteger: true,
		});
		expect(tryResolveValueArgument(localPointerContext, parseArgument('sizeof(*float64Ptr)'))).toEqual({
			value: 8,
			isInteger: true,
		});
	});

	it('resolves explicit value expression nodes', () => {
		expect(
			tryResolveValueArgument(mockContext, {
				type: ArgumentType.COMPILE_TIME_EXPRESSION,
				left: parseCompileTimeOperand('2'),
				operator: '*',
				right: parseCompileTimeOperand('sizeof(samples)'),
			})
		).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('resolves exponentiation with sizeof: sizeof(name)^literal', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(samples)^2'))).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('resolves addition with sizeof: sizeof(name)+1', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(samples)+1'))).toEqual({
			value: 3,
			isInteger: true,
		});
	});

	it('resolves subtraction with sizeof: sizeof(name)-1', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(samples)-1'))).toEqual({
			value: 1,
			isInteger: true,
		});
	});

	it('resolves intermodule start-address reference (&module:memory) once module is laid out', () => {
		const buffer = createMemoryDeclaration('buffer', {
			byteAddress: 8,
			allocationUnitCount: 4,
			numberOfElements: 4,
			elementWordSize: 4,
		});
		const laidOutNamespace = withRemoteModules(mockContext, [
			createPlannedModule('source', { buffer }, { byteAddress: 8, allocationUnitCount: 4 }),
		]);

		expect(tryResolveValueArgument(laidOutNamespace, classifyIdentifier('&source:buffer'))).toEqual({
			value: 8,
			isInteger: true,
			address: {
				safeRange: {
					source: 'memory-start',
					byteAddress: 8,
					safeByteLength: 16,
					moduleId: 'source',
					memoryId: 'buffer',
				},
			},
		});
	});

	it('resolves intermodule end-address reference (module:memory&) once module is laid out', () => {
		const buffer = createMemoryDeclaration('buffer', {
			byteAddress: 8,
			allocationUnitCount: 4,
			numberOfElements: 4,
			elementWordSize: 4,
		});
		const laidOutNamespace = withRemoteModules(mockContext, [
			createPlannedModule('source', { buffer }, { byteAddress: 8, allocationUnitCount: 4 }),
		]);

		// End address = byteAddress + (allocationUnitCount - 1) * 4 = 8 + 3 * 4 = 20
		expect(tryResolveValueArgument(laidOutNamespace, classifyIdentifier('source:buffer&'))).toEqual({
			value: 20,
			isInteger: true,
			address: {
				safeRange: {
					source: 'memory-end',
					byteAddress: 20,
					safeByteLength: 4,
					moduleId: 'source',
					memoryId: 'buffer',
				},
			},
		});
	});

	it('resolves intermodule module-base start-address (&module:) once module is laid out', () => {
		const laidOutNamespace = withRemoteModules(mockContext, [
			createPlannedModule('source', {}, { byteAddress: 12, allocationUnitCount: 3 }),
		]);

		expect(tryResolveValueArgument(laidOutNamespace, classifyIdentifier('&source:'))).toEqual({
			value: 12,
			isInteger: true,
			address: {
				safeRange: {
					source: 'module-start',
					byteAddress: 12,
					safeByteLength: 12,
					moduleId: 'source',
				},
			},
		});
	});

	it('resolves intermodule module-base end-address (module:&) once module is laid out', () => {
		const laidOutNamespace = withRemoteModules(mockContext, [
			createPlannedModule('source', {}, { byteAddress: 12, allocationUnitCount: 3 }),
		]);

		// End address = 12 + (3 - 1) * 4 = 12 + 8 = 20
		expect(tryResolveValueArgument(laidOutNamespace, classifyIdentifier('source:&'))).toEqual({
			value: 20,
			isInteger: true,
			address: {
				safeRange: {
					source: 'module-end',
					byteAddress: 20,
					safeByteLength: 4,
					moduleId: 'source',
				},
			},
		});
	});

	it('returns undefined for missing intermodule address references', () => {
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('&source:buffer'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('&source:'))).toBeUndefined();
	});

	it('returns undefined for unresolved intermodule nth references', () => {
		const laidOutNamespace = withRemoteModules(mockContext, [
			createPlannedModule('source', {}, { byteAddress: 8, allocationUnitCount: 4 }),
		]);

		expect(tryResolveValueArgument(laidOutNamespace, classifyIdentifier('&source:99'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('&source:99'))).toBeUndefined();
	});

	it('resolves current-module shorthands from compilation context', () => {
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('&this'))).toEqual({
			value: 24,
			isInteger: true,
			address: {
				safeRange: {
					source: 'module-start',
					byteAddress: 24,
					safeByteLength: 20,
					moduleId: 'main',
				},
			},
		});
		expect(tryResolveValueArgument(mockContext, classifyIdentifier('this&'))).toEqual({
			value: 40,
			isInteger: true,
			address: {
				safeRange: {
					source: 'module-end',
					byteAddress: 40,
					safeByteLength: 4,
					moduleId: 'main',
				},
			},
		});
	});

	it('returns undefined for current-module shorthands without a current planned module', () => {
		const contextWithoutCurrentModule = {
			...mockContext,
			currentModule: undefined,
		} as unknown as MemoryReferenceResolutionContext;

		expect(tryResolveValueArgument(contextWithoutCurrentModule, classifyIdentifier('&this'))).toBeUndefined();
		expect(tryResolveValueArgument(contextWithoutCurrentModule, classifyIdentifier('this&'))).toBeUndefined();
	});

	it('keeps address metadata when adding an in-range integer offset to an address expression', () => {
		const arr = createMemoryDeclaration('arr', {
			byteAddress: 16,
			allocationUnitCount: 4,
			numberOfElements: 4,
			elementWordSize: 4,
		});
		const addressContext = createTestContext(createPlannedModule('main', { arr }));

		expect(tryResolveValueArgument(addressContext, parseArgument('&arr+4'))).toEqual({
			value: 20,
			isInteger: true,
			address: {
				safeRange: {
					source: 'memory-start',
					byteAddress: 20,
					safeByteLength: 12,
					memoryId: 'arr',
				},
			},
		});
	});

	it('keeps address metadata when adding an address expression to an integer offset', () => {
		const arr = createMemoryDeclaration('arr', {
			byteAddress: 16,
			allocationUnitCount: 4,
			numberOfElements: 4,
			elementWordSize: 4,
		});
		const addressContext = createTestContext(createPlannedModule('main', { arr }));

		expect(tryResolveValueArgument(addressContext, parseArgument('4+&arr'))).toEqual({
			value: 20,
			isInteger: true,
			address: {
				safeRange: {
					source: 'memory-start',
					byteAddress: 20,
					safeByteLength: 12,
					memoryId: 'arr',
				},
			},
		});
	});

	it('drops address metadata when address expression arithmetic leaves the known safe range', () => {
		const arr = createMemoryDeclaration('arr', {
			byteAddress: 16,
			allocationUnitCount: 4,
			numberOfElements: 4,
			elementWordSize: 4,
		});
		const addressContext = createTestContext(createPlannedModule('main', { arr }));

		expect(tryResolveValueArgument(addressContext, parseArgument('&arr+1024'))).toEqual({
			value: 1040,
			isInteger: true,
		});
		expect(tryResolveValueArgument(addressContext, parseArgument('&arr-4'))).toEqual({
			value: 12,
			isInteger: true,
		});
	});

	it('returns undefined for division by zero and non-identifier arguments', () => {
		expect(tryResolveValueArgument(mockContext, parseArgument('sizeof(samples)/0'))).toBeUndefined();
		expect(tryResolveValueArgument(mockContext, parseArgument('123'))).toBeUndefined();
	});
});

describe('metadata query compatibility', () => {
	const queries = ['count', 'sizeof', 'max', 'min'] as const;
	const samples = createMemoryDeclaration('samples', {
		type: 'int16u',
		numberOfElements: 7,
		elementWordSize: 2,
		isUnsigned: true,
	});
	const main = createPlannedModule('main', { samples });
	const source = createPlannedModule('audio/source', { samples });
	const context = createTestContext(main, {
		memoryPlan: createMemoryPlan([main, source]),
		memoryAliases: new Map([
			['audio', new Map([['exported', { targetModuleId: 'audio/source', targetMemoryId: 'samples' }]])],
		]),
	});

	it('resolves one canonical target independently of the query kind', () => {
		expect(resolveMetadataTarget({ scope: 'local', targetMemoryId: 'samples', dereferenceDepth: 0 }, context)).toEqual({
			kind: 'memory',
			memory: samples,
		});
		expect(
			resolveMetadataTarget(
				{ scope: 'intermodule', targetModuleId: 'audio', targetMemoryId: 'exported', dereferenceDepth: 0 },
				context
			)
		).toEqual({
			kind: 'memory',
			memory: samples,
		});
		expect(
			resolveMetadataTarget({ scope: 'local', targetMemoryId: 'missing', dereferenceDepth: 0 }, context)
		).toBeUndefined();
	});

	it('collects pointer facts once in memory-before-local order', () => {
		const pointer = createMemoryDeclaration('ptr', { pointeeBaseType: 'int8', pointerDepth: 1 });
		const local = { isInteger: true, pointeeBaseType: 'float64', pointerDepth: 1, pointeeElementCount: 3 } as const;
		const pointerContext = createTestContext(createPlannedModule('main', { ptr: pointer }), {
			pointerMetadata: { main: { ptr: { pointeeElementCount: 1 } } },
			locals: { ptr: local, localOnly: local },
		});
		expect(
			resolveMetadataTarget({ scope: 'local', targetMemoryId: 'ptr', dereferenceDepth: 1 }, pointerContext)
		).toEqual({
			kind: 'pointer',
			pointers: [{ ...pointer, pointeeElementCount: 1 }, local],
		});
		expect(
			resolveMetadataTarget({ scope: 'local', targetMemoryId: 'localOnly', dereferenceDepth: 1 }, pointerContext)
		).toEqual({
			kind: 'pointer',
			pointers: [local],
		});
	});

	it.each(['samples', 'this:samples', 'audio/source:samples', 'audio:exported'])(
		'resolves all queries for %s through the same memory facts',
		target => {
			for (const [index, query] of queries.entries()) {
				expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(${target})`), context)).toEqual({
					value: [7, 2, 65535, 0][index],
					isInteger: true,
				});
			}
		}
	);

	it.each(['missing', 'missing:samples', 'audio/source:missing', '*missing'])(
		'keeps %s unresolved for every query',
		target => {
			for (const query of queries) {
				expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(${target})`), context)).toBeUndefined();
			}
		}
	);

	it.each([
		['int8', 1, 127, -128, true],
		['int8u', 1, 255, 0, true],
		['int16', 2, 32767, -32768, true],
		['int16u', 2, 65535, 0, true],
		['int', 4, 2147483647, -2147483648, true],
		['float', 4, 3.4028234663852886e38, -3.4028234663852886e38, false],
		['float64', 8, Number.MAX_VALUE, -Number.MAX_VALUE, false],
	] as const)('uses identical memory and local pointer metadata for %s', (baseType, size, max, min, isInteger) => {
		const pointer = createMemoryDeclaration('memoryPtr', { pointeeBaseType: baseType, pointerDepth: 1 });
		const pointerContext = createTestContext(createPlannedModule('main', { memoryPtr: pointer }), {
			pointerMetadata: { main: { memoryPtr: { pointeeElementCount: 1 } } },
			locals: { localPtr: { isInteger: true, pointeeBaseType: baseType, pointerDepth: 1, pointeeElementCount: 1 } },
		});
		for (const target of ['memoryPtr', 'localPtr']) {
			for (const [index, query] of queries.entries()) {
				expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(*${target})`), pointerContext)).toEqual({
					value: [1, size, max, min][index],
					isInteger: index < 2 || isInteger,
				});
			}
		}
	});

	it.each([0, 1, 8, undefined])('preserves count %s and one-star pointer-slot semantics for double pointers', count => {
		const pointer = createMemoryDeclaration('ptr', { pointeeBaseType: 'float64', pointerDepth: 2 });
		for (const storage of ['memory', 'local']) {
			const pointerContext = createTestContext(
				createPlannedModule('main', storage === 'memory' ? { ptr: pointer } : {}),
				{
					pointerMetadata: { main: { ptr: { pointeeElementCount: count } } },
					locals:
						storage === 'local'
							? { ptr: { isInteger: true, pointeeBaseType: 'float64', pointerDepth: 2, pointeeElementCount: count } }
							: {},
				}
			);
			for (const [index, query] of queries.entries()) {
				const result = resolveMemoryExpressionOperand(classifyIdentifier(`${query}(*ptr)`), pointerContext);
				expect(result).toEqual(
					index === 0 && count === undefined
						? undefined
						: { value: [count, 4, 2147483647, -2147483648][index], isInteger: true }
				);
			}
		}
	});

	it('preserves memory precedence and the local known-count fallback', () => {
		const pointer = createMemoryDeclaration('ptr', { pointeeBaseType: 'int8', pointerDepth: 1 });
		const pointerContext = createTestContext(createPlannedModule('main', { ptr: pointer }), {
			locals: { ptr: { isInteger: true, pointeeBaseType: 'float64', pointerDepth: 1, pointeeElementCount: 3 } },
		});
		for (const [index, query] of queries.entries()) {
			expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(*ptr)`), pointerContext)).toEqual({
				value: [3, 1, 127, -128][index],
				isInteger: true,
			});
		}
		pointerContext.pointerMetadata = { main: { ptr: { pointeeElementCount: 0 } } };
		expect(resolveMemoryExpressionOperand(classifyIdentifier('count(*ptr)'), pointerContext)).toEqual({
			value: 0,
			isInteger: true,
		});
	});

	it('preserves nonpointer memory results and rejects scalar locals as pointee targets', () => {
		const scalarContext = { ...context, locals: { scalar: { isInteger: true } } };
		for (const query of queries) {
			expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(*scalar)`), scalarContext)).toBeUndefined();
			expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(scalar)`), scalarContext)).toBeUndefined();
			expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(*samples)`), scalarContext)).toEqual(
				query === 'count' ? undefined : { value: 0, isInteger: query === 'sizeof' }
			);
		}
	});

	it('leaves currently unsupported second-star metadata queries unresolved', () => {
		const pointerContext = createTestContext(
			createPlannedModule('main', {
				ptr: createMemoryDeclaration('ptr', { pointeeBaseType: 'float64', pointerDepth: 2 }),
			})
		);
		for (const query of queries) {
			expect(resolveMemoryExpressionOperand(classifyIdentifier(`${query}(**ptr)`), pointerContext)).toBeUndefined();
		}
	});
});
