import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { recompileDebounceDelayEditorConfigValidator } from './editorConfig';
import compilerEffect from './effect';

describe('program compiler effect', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockCompileCode: MockInstance;

	beforeEach(() => {
		vi.useFakeTimers();

		mockCompileCode = vi.fn().mockRejectedValue({
			message: 'Memory access is not allowed in pure functions. (19)',
			line: { lineNumber: 2 },
			context: {
				codeBlockId: 'helper',
				codeBlockType: 'function',
				projectBlockId: 0,
			},
		});

		mockState = createMockState({
			callbacks: {
				compileCode: mockCompileCode,
			},
		});

		const helperBlock = createMockCodeBlock({
			name: 'helper',
			code: ['function helper', 'push 1', 'functionEnd'],
			creationIndex: 0,
			blockType: 'function',
		});

		mockState.codeBlockRendering.codeBlocks.push(helperBlock);

		store = createStateManager(mockState);
	});

	afterEach(() => {
		store.dispose();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	async function triggerCompile(delayMs = 500): Promise<void> {
		compilerEffect(store);
		store.set('compilerInputRevision', mockState.compilerInputRevision + 1);
		await vi.advanceTimersByTimeAsync(delayMs);
	}

	it('subscribes only to the compiler input revision', () => {
		const subscribeSpy = vi.spyOn(store, 'subscribe');
		compilerEffect(store);
		expect(subscribeSpy).toHaveBeenCalledExactlyOnceWith('compilerInputRevision', expect.any(Function));
	});

	it('debounces multiple revisions and compiles the current project independently of selection', async () => {
		compilerEffect(store);
		store.set('compilerInputRevision', 1);
		await vi.advanceTimersByTimeAsync(300);
		const block = mockState.codeBlockRendering.rootCodeBlocks[0];
		block.code = ['function helper', 'push 2', 'functionEnd'];
		store.set('compilerInputRevision', 2);
		await vi.advanceTimersByTimeAsync(499);
		expect(mockCompileCode).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.objectContaining({ functions: [expect.objectContaining({ code: block.code })] }),
			expect.anything()
		);
	});

	it.each([false, true])('enables assertions for a test module with disabled=%s', async disabled => {
		mockState.codeBlockRendering.rootCodeBlocks.push(
			createMockCodeBlock({
				blockType: 'module',
				entry: 'test',
				disabled,
				code: ['module checks', 'push 1', 'assert', 'moduleEnd'],
			})
		);

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ enableAssertions: !disabled })
		);
	});

	it('enables assertions for a test module in a nested project', async () => {
		mockState.codeBlockRendering.rootCodeBlocks.push(
			createMockCodeBlock({
				name: 'nested',
				code: ['project nested', 'projectEnd'],
				nestedProjectCodeBlocks: [
					createMockCodeBlock({
						blockType: 'module',
						entry: 'test',
						code: ['module checks', 'push 1', 'assert', 'moduleEnd'],
					}),
				],
			})
		);

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ enableAssertions: true })
		);
	});

	it.each([
		['test', '#export', true],
		['checks', '#export test', true],
		['test', '', false],
	])('detects a root test function %s with directive %s', async (name, directive, enabled) => {
		mockState.codeBlockRendering.rootCodeBlocks.push(
			createMockCodeBlock({
				blockType: 'function',
				code: [`function ${name}`, directive, 'push 1', 'assert', 'functionEnd'],
			})
		);

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ enableAssertions: enabled })
		);
	});

	it('stores code block type for compiler errors', async () => {
		await triggerCompile();

		expect(mockState.codeErrors.compilationErrors).toEqual([
			{
				lineNumber: 2,
				codeBlockId: 0,
				codeBlockType: 'function',
				message: 'Memory access is not allowed in pure functions. (19)',
			},
		]);
	});

	it('reads line number from syntax errors that expose line directly (no longer defaults to 0)', async () => {
		mockCompileCode.mockRejectedValue({
			message: 'Too many arguments for if.',
			line: { lineNumber: 3, instruction: 'if' },
			context: { projectBlockId: 0 },
		});

		await triggerCompile();

		expect(mockState.codeErrors.compilationErrors).toEqual([
			{
				lineNumber: 3,
				codeBlockId: 0,
				codeBlockType: undefined,
				message: 'Too many arguments for if.',
			},
		]);
	});

	it('stores the owning project path for project-scope compiler errors', async () => {
		mockCompileCode.mockRejectedValue({
			message: 'Passed constant namespace env is undefined in the parent project scope.',
			line: { lineNumber: 1, instruction: 'pass' },
			context: { projectGroupPath: 'audio' },
		});

		await triggerCompile();

		expect(mockState.codeErrors.compilationErrors).toEqual([
			{
				lineNumber: 1,
				codeBlockId: -1,
				codeBlockType: undefined,
				projectGroupPath: 'audio',
				message: 'Passed constant namespace env is undefined in the parent project scope.',
			},
		]);
	});

	it('stores compilation stats in state.info.compiler from successful compilation results', async () => {
		mockCompileCode.mockResolvedValue({
			codeBuffer: new Uint8Array([0x00]),
			compiledModules: {},
			compiledFunctions: {},
			requiredMemoryBytes: 0,
			allocatedMemoryBytes: 65536,
			astCacheStats: { hits: 4, misses: 2 },
			memoryAction: { action: 'reused' },
		});

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.objectContaining({
				modules: expect.any(Array),
				constants: expect.any(Array),
				functions: expect.any(Array),
				prototypes: expect.any(Array),
			}),
			{
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: false,
			}
		);
		expect(mockState.info.compiler).toMatchObject({
			isCompiling: false,
			compilationTimeMs: expect.any(Number),
			wasmByteCodeBytes: 1,
			requiredMemoryBytes: 0,
			allocatedMemoryBytes: 65536,
			allocatedPages: 1,
			memoryUsagePercent: 0,
			astCacheHits: 4,
			astCacheMisses: 2,
			memoryReinitialized: false,
		});
	});

	it('includes stack analysis when code line selection is disabled', async () => {
		mockState.featureFlags.codeLineSelection = false;
		mockCompileCode.mockResolvedValue({
			codeBuffer: new Uint8Array([0x00]),
			compiledModules: {},
			compiledFunctions: {},
			requiredMemoryBytes: 0,
			allocatedMemoryBytes: 65536,
			astCacheStats: { hits: 0, misses: 0 },
			memoryAction: { action: 'reused' },
		});

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.objectContaining({
				modules: expect.any(Array),
				constants: expect.any(Array),
				functions: expect.any(Array),
				prototypes: expect.any(Array),
			}),
			{
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: false,
			}
		);
	});

	it('registers the recompile debounce delay editor config validator', () => {
		compilerEffect(store);

		expect(mockState.editorConfigValidators.recompileDebounceDelay).toBe(recompileDebounceDelayEditorConfigValidator);
	});

	it('cancels a scheduled compilation when disposed', async () => {
		const dispose = compilerEffect(store);
		store.set('compilerInputRevision', mockState.compilerInputRevision + 1);
		dispose();
		store.set('compilerInputRevision', mockState.compilerInputRevision + 1);
		await vi.advanceTimersByTimeAsync(500);

		expect(mockCompileCode).not.toHaveBeenCalled();
	});

	it('clears diagnostics without starting compilation when the callback is absent', async () => {
		mockState.callbacks.compileCode = undefined;
		mockState.codeErrors.compilationErrors = [{ lineNumber: 1, codeBlockId: 0, message: 'Previous error' }];
		await triggerCompile();
		expect(mockState.codeErrors.compilationErrors).toEqual([]);
		expect(mockState.compiler.isCompiling).toBe(false);
		expect(mockCompileCode).not.toHaveBeenCalled();
	});

	it('ignores a compilation failure that arrives after disposal', async () => {
		let rejectCompilation!: (error: unknown) => void;
		mockCompileCode.mockImplementation(
			() =>
				new Promise((_, reject) => {
					rejectCompilation = reject;
				})
		);
		const dispose = compilerEffect(store);
		store.set('compilerInputRevision', 1);
		await vi.advanceTimersByTimeAsync(500);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		dispose();
		const setSpy = vi.spyOn(store, 'set');
		rejectCompilation({ message: 'Late failure', line: { lineNumber: 2 }, context: {} });
		await vi.advanceTimersByTimeAsync(0);
		expect(setSpy).not.toHaveBeenCalled();
	});

	it('passes the includes collection to the compiler callback', async () => {
		mockCompileCode.mockResolvedValue({
			codeBuffer: new Uint8Array([0x00]),
			compiledModules: {},
			compiledFunctions: {},
			requiredMemoryBytes: 0,
			allocatedMemoryBytes: 65536,
			astCacheStats: { hits: 0, misses: 0 },
			memoryAction: { action: 'reused' },
		});
		const includesBlock = createMockCodeBlock({
			name: 'includes',
			code: [
				'includes',
				'; @pos 0 0',
				'include std/events/risingEdge',
				'include std/memory/wrapPointer',
				'includesEnd',
			],
			creationIndex: 10,
			blockType: 'includes',
		});
		mockState.codeBlockRendering.codeBlocks.unshift(includesBlock);

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.objectContaining({
				includes: [expect.objectContaining({ id: 10, code: includesBlock.code })],
			}),
			expect.not.objectContaining({ resolveInclude: expect.anything() })
		);
	});

	it('uses the configured recompile debounce delay', async () => {
		mockState.editorConfig.recompileDebounceDelay = 120;
		compilerEffect(store);
		store.set('compilerInputRevision', mockState.compilerInputRevision + 1);
		await vi.advanceTimersByTimeAsync(119);
		expect(mockCompileCode).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
	});

	it('uses the default recompile debounce delay when the config value is absent', async () => {
		compilerEffect(store);
		store.set('compilerInputRevision', mockState.compilerInputRevision + 1);
		await vi.advanceTimersByTimeAsync(499);
		expect(mockCompileCode).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
	});
});
