import type { PlannedMemoryDeclaration, PlannedMemoryModule } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import resolveMemoryIdentifier, { getDeclarationsByByteAddress } from './resolveMemoryIdentifier';
import { createMockState } from './testingUtils/testUtils';

function createMemory(
	id: string,
	byteAddress: number,
	overrides: Partial<PlannedMemoryDeclaration> = {}
): PlannedMemoryDeclaration {
	return {
		id,
		numberOfElements: 1,
		elementWordSize: 4,
		elementByteLength: 4,
		type: 'int' as const,
		byteAddress,
		allocationUnitAddress: byteAddress / 4,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		endByteAddress: byteAddress,
		endAddressSafeByteLength: 4,
		lineNumber: 1,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
}

function createModule(id: string, declarations: PlannedMemoryDeclaration[]): PlannedMemoryModule {
	return {
		id,
		lineNumber: 0,
		byteAddress: declarations[0]?.byteAddress ?? 0,
		allocationUnitCount: declarations.reduce((size, declaration) => size + declaration.allocationUnitCount, 0),
		allocatedByteLength: declarations.reduce((size, declaration) => size + declaration.allocatedByteLength, 0),
		endByteAddress: declarations.at(-1)?.endByteAddress ?? 0,
		endAddressSafeByteLength: declarations.at(-1)?.endAddressSafeByteLength ?? 0,
		memory: Object.fromEntries(declarations.map(declaration => [declaration.id, declaration])),
		declarations,
		declarationSources: [],
	};
}

describe('resolveMemoryIdentifier', () => {
	it('resolves intermodule references relative to the current project path', () => {
		const state = createMockState();
		const memory = createMemory('value', 16);
		state.compiler.result.memoryPlan.modules['audio/source'] = createModule('audio/source', [memory]);

		expect(resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'audio/consumer' }, 'source:value')?.memory).toBe(
			memory
		);
		expect(resolveMemoryIdentifier(state, { kind: 'project', groupPath: '' }, 'audio/source:value')?.memory).toBe(
			memory
		);
	});

	it('resolves a dereferenced pointer from the memory plan without rendered outputs', () => {
		const state = createMockState();
		const pointer = createMemory('pointer', 4, {
			type: 'int*' as const,
			pointeeBaseType: 'int',
			pointerDepth: 1,
		});
		const pointee = createMemory('value', 40);
		const watcherModule = createModule('watcher', [pointer]);
		const pointeeModule = createModule('pointee', [pointee]);
		state.compiler.result.memoryPlan.modules = { watcher: watcherModule, pointee: pointeeModule };
		state.compiler.result.memoryPlan.moduleList = [watcherModule, pointeeModule];
		state.callbacks.getWordFromMemory = () => pointee.byteAddress;

		expect(resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'watcher' }, '*pointer')?.memory).toBe(pointee);
	});

	it('builds the byteAddress index once per memory plan and reflects runtime pointer changes without rescanning', () => {
		const state = createMockState();
		const pointer = createMemory('pointer', 4, {
			type: 'int*' as const,
			pointeeBaseType: 'int',
			pointerDepth: 1,
		});
		const pointeeA = createMemory('valueA', 40);
		const pointeeB = createMemory('valueB', 80);
		const watcherModule = createModule('watcher', [pointer]);
		const pointeeModule = createModule('pointee', [pointeeA, pointeeB]);

		let declarationReads = 0;
		const declarationsList = [pointeeA, pointeeB];
		Object.defineProperty(pointeeModule, 'declarations', {
			enumerable: true,
			get() {
				declarationReads += 1;
				return declarationsList;
			},
		});

		state.compiler.result.memoryPlan.modules = { watcher: watcherModule, pointee: pointeeModule };
		state.compiler.result.memoryPlan.moduleList = [watcherModule, pointeeModule];

		let currentTargetAddress = pointeeA.byteAddress;
		state.callbacks.getWordFromMemory = () => currentTargetAddress;

		expect(resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'watcher' }, '*pointer')?.memory).toBe(pointeeA);
		expect(declarationReads).toBe(1);

		const initialIndex = getDeclarationsByByteAddress(state.compiler.result.memoryPlan);
		currentTargetAddress = pointeeB.byteAddress;

		expect(resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'watcher' }, '*pointer')?.memory).toBe(pointeeB);
		expect(declarationReads).toBe(1);
		expect(getDeclarationsByByteAddress(state.compiler.result.memoryPlan)).toBe(initialIndex);

		currentTargetAddress = 9999;
		expect(resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'watcher' }, '*pointer')).toBeUndefined();
		expect(declarationReads).toBe(1);
	});

	it('preserves first-match declaration order when duplicate byte addresses exist', () => {
		const state = createMockState();
		const pointer = createMemory('pointer', 4, {
			type: 'int*' as const,
			pointeeBaseType: 'int',
			pointerDepth: 1,
		});
		const firstMatch = createMemory('first', 64);
		const sameModuleDuplicate = createMemory('sameModuleDuplicate', 64);
		const crossModuleDuplicate = createMemory('crossModuleDuplicate', 64);

		const watcherModule = createModule('watcher', [pointer]);
		const moduleA = createModule('moduleA', [firstMatch, sameModuleDuplicate]);
		const moduleB = createModule('moduleB', [crossModuleDuplicate]);

		state.compiler.result.memoryPlan.modules = { watcher: watcherModule, moduleA, moduleB };
		state.compiler.result.memoryPlan.moduleList = [watcherModule, moduleA, moduleB];
		state.callbacks.getWordFromMemory = () => 64;

		expect(resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'watcher' }, '*pointer')?.memory).toBe(
			firstMatch
		);
	});

	it('resolves address zero when present and invalidates stale targets when the memory plan changes', () => {
		const state = createMockState();
		const zeroTarget = createMemory('atZero', 0);
		const pointer = createMemory('pointer', 4, {
			type: 'int*' as const,
			pointeeBaseType: 'int',
			pointerDepth: 1,
		});
		const initialTarget = createMemory('initialTarget', 32);
		const watcherModule = createModule('watcher', [zeroTarget, pointer, initialTarget]);

		state.compiler.result.memoryPlan.modules = { watcher: watcherModule };
		state.compiler.result.memoryPlan.moduleList = [watcherModule];

		let runtimeAddress = 0;
		state.callbacks.getWordFromMemory = () => runtimeAddress;

		const resolvePointer = () => resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'watcher' }, '*pointer');

		expect(resolvePointer()?.memory).toBe(zeroTarget);

		runtimeAddress = initialTarget.byteAddress;
		expect(resolvePointer()?.memory).toBe(initialTarget);

		const recompiledTarget = createMemory('recompiledTarget', 48);
		const recompiledModule = createModule('watcher', [pointer, recompiledTarget]);
		state.compiler.result.memoryPlan = {
			modules: { watcher: recompiledModule },
			moduleList: [recompiledModule],
		};

		// Previous target at byteAddress 32 is no longer in the replaced memoryPlan
		expect(resolvePointer()).toBeUndefined();

		runtimeAddress = recompiledTarget.byteAddress;
		expect(resolvePointer()?.memory).toBe(recompiledTarget);
		expect(getDeclarationsByByteAddress(undefined)).toBeUndefined();
	});
});
