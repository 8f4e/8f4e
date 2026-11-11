import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
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

describe.each(['module', 'function'] as const)('inline operand tooltips in a %s', blockType => {
	it.each([
		{ name: 'continued operand', lines: ['sub', '- 3'], signature: 'sub (T -- T)', before: 'before [-int=8]' },
		{
			name: 'continued operand with comments',
			lines: ['sub ; subtract the continued operand', '; operand comment', '- 3 ; right operand'],
			signature: 'sub (T -- T)',
			before: 'before [-int=8]',
		},
		{ name: 'inline operand', lines: ['sub 3 ; right operand'], signature: 'sub (T -- T)', before: 'before [-int=8]' },
		{
			name: 'stack operands',
			lines: ['push 3', 'sub ; use the stack'],
			signature: 'sub (T T -- T)',
			before: 'before [-int=8, -int=3]',
		},
	])('matches the parsed stack effect for $name', async ({ lines, signature, before }) => {
		const body = ['push 8', ...lines, 'drop'].join('\n');
		const project = parseProjectSource(
			blockType === 'module'
				? `8f4e/v1\nentry main\nmodule sample\n${body}\nmoduleEnd\nentryEnd`
				: `8f4e/v1\nentry main\nmodule caller\ncall sample\nmoduleEnd\nentryEnd\nfunction sample\n${body}\nfunctionEnd`
		);
		const compiled = await compileProject(project, { includeStackAnalysis: true });
		const events = createEvents();
		const store = initState(events, { callbacks: {} });
		const tooltip = createTooltip(store, events);
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});
		events.dispatch('enterEditMode');
		Object.assign(store.getState().compiler.result, compiled);
		store.set('initialProjectState', project);
		const block = store.getState().codeBlockRendering.currentProject.blocks.find(block => block.name === 'sample')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set(
			'codeBlockRendering.selectedCodeBlock.cursor.row',
			block.code.findIndex(line => line.startsWith('sub'))
		);

		expect(tooltip.getState().text[0]).toBe(signature);
		expect(tooltip.getState().text).toContain(before);
		expect(tooltip.getState().text).toContain('after: [+int=5]');
	});
});

describe('tooltip effect', () => {
	it('uses current source classification while accepted compiler metadata lags incomplete edits', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
module sample
push 8
sub 3
drop
moduleEnd
entryEnd`);
		const compiled = await compileProject(project, { includeStackAnalysis: true });
		const events = createEvents();
		const store = initState(events, { callbacks: {} });
		const tooltip = createTooltip(store, events);
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});
		events.dispatch('enterEditMode');
		store.set('compiler.result', compiled);
		store.set('initialProjectState', project);
		const block = store.getState().codeBlockRendering.currentProject.blocks.find(block => block.name === 'sample')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
		expect(tooltip.getState().text[0]).toBe('sub (T -- T)');
		const editLine = (line: string) => {
			const code = [...block.code];
			code[2] = line;
			applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code }], { affectsCompilation: true });
		};
		editLine('mul');
		expect(tooltip.getState().text[0]).toBe('mul (T T -- T)');
		for (const line of ['float& input &', 'float&']) {
			editLine(line);
			expect(tooltip.getState().text.join(' ')).toContain('Binds a typed, fixed memory reference');
			expect(tooltip.getState().liveValues).toEqual([]);
		}
	});
	it('adds selected line stack analysis when compiler data is available', () => {
		const selectedBlock = createMockCodeBlock({
			code: ['push 1', 'push 2', 'add'],
			name: 'test',
			cursor: {
				row: 2,
				col: 0,
				y: 0,
			},
		});
		const state = createMockState({
			compiler: {
				result: {
					compiledModules: {
						test: {
							ast: { projectBlockId: 0, lines: [] },
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
							ast: { projectBlockId: 99, lines: [] },
							stackAnalysis: [],
						} as never,
						[functionId]: {
							id: functionId,
							name: 'helper',
							ast: { projectBlockId: 42, lines: [] },
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
				y: 0,
			},
		});
		const state = createMockState({
			compiler: {
				result: {
					compiledModules: { [moduleId]: { id: moduleId, ast: { projectBlockId: 0, lines: [] } } },
					memoryDefaultsByModuleId: { [moduleId]: { 0: { value: 0 } } },
					memoryPlan: {
						modules: {
							[moduleId]: {
								id: 'test',
								lineNumber: 0,
								byteAddress: 0,
								allocationUnitCount: 0,
								allocatedByteLength: 0,
								endByteAddress: 0,
								memory: {
									value: {
										id: 0,
										name: 'value',
										numberOfElements: 1,
										byteAddress: 4,
										allocationUnitAddress: 1,
										elementWordSize: 4,
										isInteger: true,
										isUnsigned: false,
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
		expect(tooltip.getState().liveValues).toMatchObject([
			{
				x: tooltip.getState().layout.lineX + 'address: '.length * 8,
				y: tooltip.getState().layout.y + (tooltip.getState().text.length - 2) * 16,
				source: { kind: 'staticText', text: '4' },
				color: fontInverseAccent,
			},
			{
				x: tooltip.getState().layout.lineX + 'value: '.length * 8,
				y: tooltip.getState().layout.y + (tooltip.getState().text.length - 1) * 16,
				source: {
					kind: 'numericRead',
					read: {
						address: { kind: 'fixed', byteAddress: 4 },
						elementIndex: 1,
						spec: { valueType: 'int32', elementByteSize: 4, isInteger: true },
					},
				},
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
				y: 0,
			},
		});
		const state = createMockState({
			compiler: {
				result: {
					compiledModules: {
						'module-a': { id: 'module-a', index: 0, ast: { projectBlockId: 1, lines: [] } },
						'module-b': { id: 'module-b', index: 1, ast: { projectBlockId: 0, lines: [] } },
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
	it('refreshes after grid size changes and stops responding after disposal', () => {
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
		events.dispatch('gridSizeChanged');
		expect(tooltip.getState().layout.width).toBe((tooltip.getState().widthChars + 2) * 10);
		expect(tooltip.getState().layout.width).not.toBe(initial.layout.width);
		expect(tooltip.getState().animation.startedAt).toBe(initial.animation.startedAt);
		tooltip.dispose();
		const disposed = tooltip.getState();
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		events.dispatch('gridSizeChanged');
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
		store.set(
			'compiler.result.compiledModules',
			createMockState({
				compiler: {
					result: {
						compiledModules: {
							first: { id: 'first', index: 0, ast: { projectBlockId: 1, lines: [] } },
							test: { id: 'test', index: 1, ast: { projectBlockId: 0, lines: [] } },
						},
					},
				},
			}).compiler.result.compiledModules
		);
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
		const compile = (text: string) => compileProject(parseProjectSource(text), { includeStackAnalysis: true });
		const first = await compile(source);
		const block = createMockCodeBlock({
			name: 'caller',
			creationIndex: first.compiledModules.caller.ast.projectBlockId,
			code: ['module caller', 'call identity 1', 'drop', 'moduleEnd'],
			cursor: { row: 1, col: 0, y: 0 },
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

describe('module overrides', () => {
	it('shows source-specific metadata only on the active definition and follows recompilation', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
module voice
int value 5
push 1
drop
moduleEnd
module voice
int value 9
push 2
drop
moduleEnd
entryEnd`);
		const compile = () => compileProject(project, { includeStackAnalysis: true });
		const compiled = await compile();
		const [first, second] = project.execution;
		const inactive = createMockCodeBlock({
			name: 'voice',
			creationIndex: first.id,
			code: first.code,
			blockType: 'module',
			cursor: { row: 2, col: 0, y: 0 },
		});
		const active = createMockCodeBlock({
			name: 'voice',
			creationIndex: second.id,
			code: second.code,
			blockType: 'module',
			cursor: { row: 2, col: 0, y: 0 },
		});
		const state = createMockState({
			compiler: { result: compiled },
			codeBlockRendering: { selectedCodeBlock: inactive },
		});
		const store = createStateManager(state);
		const tooltip = createTooltip(store, createEvents());
		cleanups.push(() => {
			tooltip.dispose();
			store.dispose();
		});
		expect(tooltip.getState().text.some(line => line.startsWith('after:'))).toBe(false);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		expect(tooltip.getState().liveValues).toEqual([]);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 0);
		expect(tooltip.getState().text).not.toContain('execution order: 1');

		store.set('codeBlockRendering.selectedCodeBlock', active);
		expect(tooltip.getState().text).toContain('after: [+int=2]');
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 1);
		expect(tooltip.getState().liveValues).toHaveLength(2);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 0);
		expect(tooltip.getState().text).toContain('execution order: 1');

		store.set('codeBlockRendering.selectedCodeBlock', inactive);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
		project.execution.reverse();
		store.set('compiler.result', await compile());
		expect(tooltip.getState().text).toContain('after: [+int=1]');
	});
});
