import { EventEmitter } from 'node:events';
import { CompilerError } from '@8f4e/compiler-diagnostics';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { EditorLoadingRegistry, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { createSuccessMessage } from './__tests__/helpers';
import compilerEffect from './compilation';
import type { CompilerService } from './compiler-service';
import { compilerEditorConfigSchemaContribution } from './editor-config';

describe('compilation scheduling and publication', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockCompileCode: Mock<CompilerService['compileCode']>;
	let events: { on: EventEmitter['on']; off: EventEmitter['off']; dispatch: EventEmitter['emit'] };
	let cleanup: () => void;
	let loading: EditorLoadingRegistry;

	beforeEach(() => {
		vi.useFakeTimers();
		cleanup = () => {};
		loading = { add: () => ({ done: () => {}, fail: () => {}, cancel: () => {} }) };

		mockCompileCode = vi.fn<CompilerService['compileCode']>().mockRejectedValue(
			new CompilerError({
				kind: 'source',
				domain: 'semantic',
				code: 19,
				message: 'Memory access is not allowed in pure functions. (19)',
				location: { kind: 'block', projectBlockId: 0, projectGroupPath: '', lineNumber: 2 },
			})
		);

		mockState = createMockState();
		const emitter = new EventEmitter();
		events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };

		const helperBlock = createMockCodeBlock({
			name: 'helper',
			code: ['function helper', 'push 1', 'functionEnd'],
			creationIndex: 0,
			blockType: 'function',
		});

		mockState.codeBlockRendering.currentProject.blocks.push(helperBlock);

		store = createStateManager(mockState);
	});

	afterEach(() => {
		cleanup?.();
		store.dispose();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	async function triggerCompile(delayMs = 500): Promise<void> {
		cleanup = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(delayMs);
	}

	it('listens for compilation input changes without subscribing to editing state', () => {
		const subscribeSpy = vi.spyOn(store, 'subscribe');
		const on = vi.spyOn(events, 'on');
		cleanup = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		expect(subscribeSpy).not.toHaveBeenCalled();
		expect(on).toHaveBeenCalledWith('compilationInputChanged', expect.any(Function));
	});

	it('debounces multiple revisions and compiles the current project independently of selection', async () => {
		cleanup = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(300);
		const block = mockState.codeBlockRendering.rootProject.blocks[0];
		block.code = ['function helper', 'push 2', 'functionEnd'];
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(499);
		expect(mockCompileCode).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.objectContaining({ functions: [expect.objectContaining({ code: block.code })] }),
			expect.anything(),
			expect.any(Function)
		);
	});

	it.each([false, true])('enables assertions for a test module with disabled=%s', async disabled => {
		mockState.codeBlockRendering.rootProject.blocks.push(
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
			expect.objectContaining({ enableAssertions: true }),
			expect.any(Function)
		);
	});

	it.each([
		['test', 'main', true],
		['main', 'test', false],
	] as const)(
		'uses the root entry %s rather than local entry %s to enable assertions',
		async (parentEntry, localEntry, enabled) => {
			mockState.codeBlockRendering.rootProject.blocks.push(
				createMockCodeBlock({
					name: 'nested',
					code: ['group nested', 'groupEnd'],
					entry: parentEntry,

					childProject: {
						path: '',
						entries: [localEntry],
						blocks: [
							createMockCodeBlock({
								blockType: 'module',
								entry: localEntry,
								code: ['module checks', 'push 1', 'assert', 'moduleEnd'],
							}),
						],
					},
				})
			);

			await triggerCompile();

			expect(mockCompileCode).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ enableAssertions: enabled }),
				expect.any(Function)
			);
		}
	);

	it.each([
		['test', '#export', true],
		['checks', '#export test', true],
		['test', '', false],
	])('detects a root test function %s with directive %s', async (name, directive, enabled) => {
		mockState.codeBlockRendering.rootProject.blocks.push(
			createMockCodeBlock({
				blockType: 'function',
				code: [`function ${name}`, directive, 'push 1', 'assert', 'functionEnd'],
			})
		);

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ enableAssertions: enabled }),
			expect.any(Function)
		);
	});

	it('preserves syntax diagnostic locations', async () => {
		mockCompileCode.mockRejectedValue(
			new CompilerError({
				kind: 'source',
				domain: 'syntax',
				code: 2,
				message: 'Too many arguments for if.',
				instruction: 'if',
				location: { kind: 'block', projectBlockId: 0, projectGroupPath: '', lineNumber: 3 },
			})
		);

		await triggerCompile();

		expect(mockState.codeErrors.compiler).toEqual([
			{
				lineNumber: 3,
				codeBlockId: 0,
				message: 'Too many arguments for if.',
			},
		]);
	});

	it('stores the owning project path for project-scope compiler errors', async () => {
		mockCompileCode.mockRejectedValue(
			new CompilerError({
				kind: 'source',
				domain: 'semantic',
				code: 2,
				message: 'Passed constant namespace env is undefined in the parent project scope.',
				instruction: 'pass',
				location: { kind: 'scope', projectGroupPath: 'audio', lineNumber: 1 },
			})
		);

		await triggerCompile();

		expect(mockState.codeErrors.compiler).toEqual([
			{
				lineNumber: 1,
				projectGroupPath: 'audio',
				message: 'Passed constant namespace env is undefined in the parent project scope.',
			},
		]);
	});

	it('publishes complete metadata to every field subscriber before runtimes resume', async () => {
		const result = createSuccessMessage(new Uint8Array([0]), new WebAssembly.Memory({ initial: 1 })).payload;
		mockCompileCode.mockResolvedValue(result);
		const fields = [
			'compiledFunctions',
			'compiledModules',
			'projectMemoryExposuresByGroupPath',
			'memoryPlan',
			'memoryDefaultsByModuleId',
		] as const;
		const observed: State['compiler'][] = [];
		const allFields = [...fields, 'inputRevision', 'sourceCodeByBlockId'] as const;
		const progress: boolean[] = [];
		const accepted = vi.fn();
		store.subscribe('compiler.result', accepted);
		store.subscribe('compiler.isCompiling', value => progress.push(value));
		for (const field of allFields) {
			store.subscribe(`compiler.result.${field}`, () => observed.push({ ...mockState.compiler }));
		}

		await triggerCompile();

		expect(accepted).toHaveBeenCalledOnce();
		expect(observed).toHaveLength(allFields.length);
		for (const metadata of observed) {
			expect(metadata.isCompiling).toBe(true);
			expect(metadata.result).toBe(mockState.compiler.result);
			expect(metadata.result.inputRevision).toBe(mockState.compilerInputRevision);
			expect(metadata.result.sourceCodeByBlockId[0]).toEqual(['function helper', 'push 1', 'functionEnd']);
			for (const field of fields) expect(metadata.result[field]).toBe(result[field]);
		}
		expect(mockState.compiler.isCompiling).toBe(false);
		expect(mockState.compiler.result.inputRevision).toBe(mockState.compilerInputRevision);
		expect(mockState.compiler.result.sourceCodeByBlockId[0]).toEqual(['function helper', 'push 1', 'functionEnd']);
		expect(progress).toEqual([true, false]);
	});

	it('retains the compiled source when a metadata edit shifts lines during compilation', async () => {
		const result = createSuccessMessage(new Uint8Array([0]), new WebAssembly.Memory({ initial: 1 })).payload;
		mockCompileCode.mockImplementation(async () => {
			mockState.codeBlockRendering.rootProject.blocks[0].code.splice(1, 0, '; @favorite');
			return result;
		});
		await triggerCompile();
		expect(mockState.compiler.result.inputRevision).toBe(mockState.compilerInputRevision);
		expect(mockState.compiler.result.sourceCodeByBlockId[0]).toEqual(['function helper', 'push 1', 'functionEnd']);
		expect(mockState.codeBlockRendering.rootProject.blocks[0].code).toContain('; @favorite');
	});

	it('stores compilation stats in state.info.compiler from successful compilation results', async () => {
		mockCompileCode.mockResolvedValue({
			memoryRef: new WebAssembly.Memory({ initial: 1 }),
			memoryPlan: { modules: {}, moduleList: [] },
			memoryDefaultsByModuleId: {},
			projectMemoryExposuresByGroupPath: {},
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
				entries: [],
				execution: expect.any(Array),
				constants: expect.any(Array),
				functions: expect.any(Array),
				prototypes: expect.any(Array),
			}),
			{
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: false,
				enableMemoryGuards: true,
			},
			expect.any(Function)
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
			memoryRef: new WebAssembly.Memory({ initial: 1 }),
			memoryPlan: { modules: {}, moduleList: [] },
			memoryDefaultsByModuleId: {},
			projectMemoryExposuresByGroupPath: {},
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
				entries: [],
				execution: expect.any(Array),
				constants: expect.any(Array),
				functions: expect.any(Array),
				prototypes: expect.any(Array),
			}),
			{
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: false,
				enableMemoryGuards: true,
			},
			expect.any(Function)
		);
	});

	it('contributes the compiler config schema', () => {
		cleanup = compilerEffect({ store, events, loading }, mockCompileCode).dispose;

		expect(mockState.editorConfigSchemaContributions.compiler).toBe(compilerEditorConfigSchemaContribution);
	});

	it('cancels a scheduled compilation when disposed', async () => {
		const dispose = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		events.dispatch('compilationInputChanged');
		dispose();
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(500);

		expect(mockCompileCode).not.toHaveBeenCalled();
	});

	it('reports worker startup failures without requiring a structured compiler diagnostic', async () => {
		mockCompileCode.mockRejectedValue(new Error('Worker unavailable'));
		await triggerCompile();
		expect(mockState.codeErrors.compiler).toEqual([
			{ message: 'Internal compiler error (compilation): Worker unavailable' },
		]);
		expect(mockState.compiler.isCompiling).toBe(false);
	});

	it('ignores a compilation failure that arrives after disposal', async () => {
		let rejectCompilation!: (error: unknown) => void;
		mockCompileCode.mockImplementation(
			() =>
				new Promise((_, reject) => {
					rejectCompilation = reject;
				})
		);
		const dispose = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(500);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		dispose();
		const setSpy = vi.spyOn(store, 'set');
		rejectCompilation({ message: 'Late failure', line: { lineNumber: 2 }, context: {} });
		await vi.advanceTimersByTimeAsync(0);
		expect(setSpy).not.toHaveBeenCalled();
	});

	it('passes the includes collection to the compiler worker adapter', async () => {
		mockCompileCode.mockResolvedValue({
			memoryRef: new WebAssembly.Memory({ initial: 1 }),
			memoryPlan: { modules: {}, moduleList: [] },
			memoryDefaultsByModuleId: {},
			projectMemoryExposuresByGroupPath: {},
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
		mockState.codeBlockRendering.currentProject.blocks.unshift(includesBlock);

		await triggerCompile();

		expect(mockCompileCode).toHaveBeenCalledWith(
			expect.objectContaining({
				includes: [expect.objectContaining({ id: 10, code: includesBlock.code })],
			}),
			expect.not.objectContaining({ resolveInclude: expect.anything() }),
			expect.any(Function)
		);
	});

	it('uses the configured recompile debounce delay', async () => {
		mockState.editorConfig.recompileDebounceDelay = 120;
		cleanup = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(119);
		expect(mockCompileCode).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
	});

	it('uses the default recompile debounce delay when the config value is absent', async () => {
		cleanup = compilerEffect({ store, events, loading }, mockCompileCode).dispose;
		events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(499);
		expect(mockCompileCode).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
	});
});
