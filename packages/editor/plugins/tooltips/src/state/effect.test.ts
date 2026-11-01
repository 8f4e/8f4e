import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import { type CompiledStackAnalysisLine, createFunctionId, createProjectModuleId } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from '../__tests__/events';
import createTooltip from './effect';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

function toCharacters(text: string): number[] {
	return [...text].map(char => char.charCodeAt(0));
}

describe('tooltip effect', () => {
	it('adds selected line stack analysis when compiler data is available', () => {
		const selectedBlock = createMockCodeBlock({
			code: ['push 1', 'push 2', 'add'],
			name: 'test',
			cursor: {
				row: 2,
				col: 0,
				x: 0,
				y: 0,
			},
		});
		const state = createMockState({
			compiler: {
				result: {
					compiledModules: {
						test: {
							stackAnalysis: [
								{
									lineNumber: 2,
									instruction: 'add',
									stackAnalysis: {
										stackBefore: [
											{ kind: 'value', valueType: 'int', knownValue: 1 },
											{ kind: 'value', valueType: 'int', knownValue: 2 },
										],
										consumedOperands: [
											{ kind: 'value', valueType: 'int', knownValue: 1 },
											{ kind: 'value', valueType: 'int', knownValue: 2 },
										],
										producedStackItems: [{ kind: 'value', valueType: 'int' }],
										stackAfter: [{ kind: 'value', valueType: 'int' }],
									},
								},
							],
						} as never,
					},
				},
			},
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		expect(tooltip.getState().text).toEqual([
			'add (T T -- T)',
			'Adds two numbers of the same',
			'type and pushes the result.',
			'before [-int=1, -int=2]',
			'after: [+int]',
		]);
		expect(tooltip.getState().highlights).toEqual([
			{
				x: tooltip.getState().layout.lineX + 8 * 8,
				y: tooltip.getState().layout.y + 3 * 16,
				width: 6 * 8,
				height: 16,
				fillColor: 'negativeSoft',
			},
			{
				x: tooltip.getState().layout.lineX + 16 * 8,
				y: tooltip.getState().layout.y + 3 * 16,
				width: 6 * 8,
				height: 16,
				fillColor: 'negativeSoft',
			},
			{
				x: tooltip.getState().layout.lineX + 8 * 8,
				y: tooltip.getState().layout.y + 4 * 16,
				width: 4 * 8,
				height: 16,
				fillColor: 'positiveSoft',
			},
		]);
	});

	it('refreshes selected function analysis across recompilation, deletion, and reset', () => {
		const selectedBlock = createMockCodeBlock({
			name: 'helper',
			code: ['function helper', 'param int', 'param int', 'add', 'return', 'functionEnd'],
			blockType: 'function',
			creationIndex: 42,
			cursor: {
				row: 3,
				col: 0,
				x: 0,
				y: 0,
			},
		});
		const functionId = createFunctionId('helper', ['int', 'int']);
		const state = createMockState({
			compiler: {
				result: {
					compiledFunctions: {
						[createFunctionId('helper', ['float'])]: {
							id: createFunctionId('helper', ['float']),
							name: 'helper',
							ast: { projectBlockId: 99 },
							stackAnalysis: [],
						} as never,
						[functionId]: {
							id: functionId,
							name: 'helper',
							ast: { projectBlockId: 42 },
							stackAnalysis: [
								{
									lineNumber: 3,
									instruction: 'add',
									stackAnalysis: {
										stackBefore: [
											{ kind: 'value', valueType: 'int', knownValue: 1 },
											{ kind: 'value', valueType: 'int', knownValue: 2 },
										],
										consumedOperands: [
											{ kind: 'value', valueType: 'int', knownValue: 1 },
											{ kind: 'value', valueType: 'int', knownValue: 2 },
										],
										producedStackItems: [{ kind: 'value', valueType: 'int' }],
										stackAfter: [{ kind: 'value', valueType: 'int' }],
									},
								},
							],
						} as never,
					},
				},
			},
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		expect(tooltip.getState().text).toEqual([
			'add (T T -- T)',
			'Adds two numbers of the same',
			'type and pushes the result.',
			'before [-int=1, -int=2]',
			'after: [+int]',
		]);
		expect(tooltip.getState().highlights.map(highlight => highlight.fillColor)).toEqual([
			'negativeSoft',
			'negativeSoft',
			'positiveSoft',
		]);

		const initialFunction = state.compiler.result.compiledFunctions![functionId];
		store.set('compiler.result', {
			...state.compiler.result,
			compiledFunctions: {
				[functionId]: {
					...initialFunction,
					stackAnalysis: initialFunction.stackAnalysis!.map<CompiledStackAnalysisLine>(line => ({
						...line,
						stackAnalysis: {
							...line.stackAnalysis,
							stackAfter: [{ kind: 'value', valueType: 'int', knownValue: 9 }],
						},
					})),
				},
			},
		});
		expect(tooltip.getState().text).toContain('after: [+int=9]');

		store.set('compiler.result', { ...state.compiler.result, compiledFunctions: {} });
		expect(tooltip.getState().text.some(line => line.startsWith('after:'))).toBe(false);

		store.set('compiler.result', { ...state.compiler.result, compiledFunctions: undefined });
		expect(tooltip.getState().text.some(line => line.startsWith('after:'))).toBe(false);
	});

	it.each(['', 'group'])('writes live value metadata in project path %s', projectPath => {
		const moduleId = createProjectModuleId(projectPath, 'test');

		const fontInverseAccent = PALETTE_INDICES.inverseAccent;
		const selectedBlock = createMockCodeBlock({
			code: ['int value', 'add'],
			name: 'test',
			projectPath,
			cursor: {
				row: 0,
				col: 0,
				x: 0,
				y: 0,
			},
		});
		const state = createMockState({
			compiler: {
				result: {
					memoryPlan: {
						modules: {
							[moduleId]: {
								id: 'test',
								lineNumber: 0,
								byteAddress: 0,
								allocationUnitCount: 0,
								allocatedByteLength: 0,
								endByteAddress: 0,
								endAddressSafeByteLength: 0,
								memory: {
									value: {
										id: 'value',
										numberOfElements: 1,
										byteAddress: 4,
										allocationUnitAddress: 1,
									},
								},
								declarations: [],
								declarationSources: [],
							},
						},
						moduleList: [],
					},
				},
			},
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		expect(tooltip.getState().text.slice(-2)).toEqual(['address: ', 'value: ']);
		expect(tooltip.getState().characters.slice(-2)).toEqual([toCharacters('address: '), toCharacters('value: ')]);
		expect(tooltip.getState().layout).toMatchObject({
			horizontalPadding: 8,
			height: tooltip.getState().lineCount * 16,
			y: 0,
		});
		expect(tooltip.getState().liveValues).toEqual([
			{
				x: tooltip.getState().layout.lineX + 'address: '.length * 8,
				y: tooltip.getState().layout.y + (tooltip.getState().text.length - 2) * 16,
				source: { kind: 'memoryAddress', moduleId, memoryId: 'value' },
				color: fontInverseAccent,
			},
			{
				x: tooltip.getState().layout.lineX + 'value: '.length * 8,
				y: tooltip.getState().layout.y + (tooltip.getState().text.length - 1) * 16,
				source: { kind: 'memoryValue', moduleId, memoryId: 'value', elementIndex: 0 },
				color: fontInverseAccent,
			},
		]);
		expect(tooltip.getState().lineCount).toBe(tooltip.getState().text.length);
		expect(tooltip.getState().widthChars).toBeGreaterThanOrEqual(19);

		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);

		expect(tooltip.getState().liveValues).toEqual([]);
	});

	it('writes documentation tooltip text when the selected line changes', () => {
		const selectedBlock = createMockCodeBlock({
			code: ['add', 'drop'],
			cursor: {
				row: 0,
				col: 0,
				x: 0,
				y: 0,
			},
		});
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		expect(tooltip.getState().text).toEqual([
			'add (T T -- T)',
			'Adds two numbers of the same',
			'type and pushes the result.',
		]);

		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);

		expect(tooltip.getState().text).toEqual(['drop (T -- )', 'Removes the top value from the', 'stack.']);
	});

	it('writes module execution order for selected module instructions', () => {
		const selectedBlock = createMockCodeBlock({
			name: 'module-b',
			code: ['module module-b', 'push 1'],
			cursor: {
				row: 0,
				col: 0,
				x: 0,
				y: 0,
			},
		});
		const state = createMockState({
			compiler: {
				result: {
					compiledModules: {
						'module-a': {} as never,
						'module-b': {} as never,
					},
				},
			},
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		expect(tooltip.getState().text).toEqual(['Starts a module block.', 'execution order: 2']);

		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);

		expect(tooltip.getState().text).not.toContain('execution order: 2');
	});

	it('updates documentation tooltip text when the selected line text changes', () => {
		const selectedBlock = createMockCodeBlock({
			code: ['add'],
			cursor: {
				row: 0,
				col: 0,
				x: 0,
				y: 0,
			},
		});
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		store.set('codeBlockRendering.selectedCodeBlock.code', ['drop']);

		expect(tooltip.getState().text).toEqual(['drop (T -- )', 'Removes the top value from the', 'stack.']);
	});

	it('clears tooltip text when line selection is disabled', () => {
		const selectedBlock = createMockCodeBlock();
		const state = createMockState({
			featureFlags: {
				codeLineSelection: false,
			},
			codeBlockRendering: {
				selectedCodeBlock: selectedBlock,
			},
		});
		const store = createStateManager(state);

		const tooltip = createTooltip(store, createMockEventDispatcher());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});

		expect(tooltip.getState().text).toEqual([]);
		expect(tooltip.getState().highlights).toEqual([]);
		expect(tooltip.getState().liveValues).toEqual([]);
	});
});

describe('tooltip lifecycle', () => {
	it('refreshes after atlas reloads and stops responding after disposal', () => {
		const block = createMockCodeBlock({ code: ['add'] });
		const state = createMockState({ codeBlockRendering: { selectedCodeBlock: block } });
		const store = createStateManager(state);
		const events = createEvents();
		const tooltip = createTooltip(store, events);
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});
		const initial = tooltip.getState();
		state.viewport.vGrid = 10;
		events.dispatch('spriteSheetRerendered');
		expect(tooltip.getState().layout.width).toBe((tooltip.getState().widthChars + 2) * 10);
		expect(tooltip.getState().layout.width).not.toBe(initial.layout.width);
		expect(tooltip.getState().animation.startedAt).toBe(initial.animation.startedAt);
		tooltip.dispose();
		const disposed = tooltip.getState();
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		events.dispatch('spriteSheetRerendered');
		expect(tooltip.getState()).toBe(disposed);
	});

	it('refreshes compiler-derived content without moving the cursor', () => {
		const block = createMockCodeBlock({ name: 'test', code: ['module test'] });
		const state = createMockState({ codeBlockRendering: { selectedCodeBlock: block } });
		const store = createStateManager(state);
		const tooltip = createTooltip(store, createEvents());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});
		expect(tooltip.getState().text).not.toContain('execution order: 2');
		store.set('compiler.result.compiledModules', { first: {} as never, test: {} as never });
		expect(tooltip.getState().text).toContain('execution order: 2');
	});
});

describe('call signature updates', () => {
	it('refreshes named signatures after compilation and clears them on reset and selection changes', async () => {
		const source = `8f4e/v1
entry main
module caller
call identity 1
drop
moduleEnd
entryEnd
function identity
param int value
push value
functionEnd int`;
		const compile = (text: string) =>
			compileProject(parseProjectSource(text), { disableSharedMemory: true, includeStackAnalysis: true });
		const first = await compile(source);
		const block = createMockCodeBlock({
			name: 'caller',
			code: ['module caller', 'call identity 1', 'drop', 'moduleEnd'],
			cursor: { row: 1, col: 0, x: 0, y: 0 },
		});
		const state = createMockState({ compiler: { result: first }, codeBlockRendering: { selectedCodeBlock: block } });
		const store = createStateManager(state);
		const tooltip = createTooltip(store, createEvents());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});
		expect(tooltip.getState().text.slice(0, 2).join(' ')).toBe('call identity (value: int -- int)');
		store.set('compiler.result', await compile(source.replaceAll('value', 'input')));
		expect(tooltip.getState().text.slice(0, 2).join(' ')).toBe('call identity (input: int -- int)');
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
		expect(tooltip.getState().text[0]).toBe('drop (T -- )');
		store.set('compiler.result', { ...state.compiler.result, compiledModules: {}, compiledFunctions: {} });
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		expect(tooltip.getState().text[0]).toBe('call (args... -- returns...)');
	});
});
