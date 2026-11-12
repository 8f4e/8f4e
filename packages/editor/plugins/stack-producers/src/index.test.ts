import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { createEditorDrawerRegistry, DrawContext } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { stackProducersPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup(blockType = 'module', code = ['push 2', 'push 3', 'add', 'push 4', 'mul'], functions = '') {
	const project = parseProjectSource(
		blockType === 'module'
			? `8f4e/v1\nentry main\nmodule test\n${code.join('\n')}\ndrop\nmoduleEnd\nentryEnd\n${functions}`
			: `8f4e/v1\nfunction test\n${code.join('\n')}\nfunctionEnd int`
	);
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	store.set('initialProjectState', project);
	const state = store.getState();
	store.set('compiler.result', compiled);
	store.set('compiler.resultInputRevision', state.compilerInputRevision);
	const drawers = createEditorDrawerRegistry();
	const context = {
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
	};
	const disposeRendering = codeRenderingPlugin.setup(context);
	let disposeProducers = stackProducersPlugin.setup(context);
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!;
	store.set('compiler.resultSourceCodeByBlockId', { [block.creationIndex]: [...block.code] });
	const draw = new DrawContext({ drawSprite: vi.fn() }, 8);
	const fills = vi.spyOn(draw, 'drawFill');
	const text = vi.spyOn(draw, 'drawResolvedText');
	const memoryViews = {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
	const render = () => {
		fills.mockClear();
		text.mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock: block, memoryViews });
		return fills.mock.calls.filter(([, , color]) => color === PALETTE_INDICES.secondaryAlpha30);
	};
	const select = (row: number) => {
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', row);
	};
	cleanups.push(() => {
		disposeProducers();
		disposeRendering();
		store.dispose();
	});
	return {
		store,
		state,
		block,
		events,
		emitter,
		compiled,
		select,
		render,
		fills,
		text,
		disposeProducers: () => disposeProducers(),
		reinstall: () => {
			disposeProducers();
			disposeProducers = stackProducersPlugin.setup(context);
		},
	};
}

it.each(['module', 'function'])(
	'highlights only immediate producers in a %s and follows the selected row',
	async blockType => {
		const test = await setup(blockType);
		test.select(5);
		expect(test.render().map(([, y]) => y)).toEqual([48, 64]);
		test.select(3);
		expect(test.render().map(([, y]) => y)).toEqual([16, 32]);
		test.select(1);
		expect(test.render()).toEqual([]);
		test.store.set('codeBlockRendering.selectedCodeBlock', undefined);
		expect(test.render()).toEqual([]);
	}
);

it('uses settled gaps and grid dimensions and paints producers before selection and text', async () => {
	const test = await setup();
	test.select(5);
	const contribution = test.store.layout.createContribution();
	cleanups.push(contribution.dispose);
	contribution.update(test.block, {
		verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }],
		minGridWidth: 40,
	});
	expect(test.render()).toEqual([
		[0, 80, PALETTE_INDICES.secondaryAlpha30, test.block.width, 16],
		[0, 96, PALETTE_INDICES.secondaryAlpha30, test.block.width, 16],
	]);
	const lastFill = test.fills.mock.calls.at(-1)!;
	expect(lastFill[2]).toBe(PALETTE_INDICES.primarySoft);
	expect(test.fills.mock.invocationCallOrder.at(-1)!).toBeLessThan(test.text.mock.invocationCallOrder[0]);
	test.state.viewport.hGrid = 20;
	test.events.dispatch('gridSizeChanged');
	expect(test.render().map(([, y]) => y)).toEqual([100, 120]);
});

it('clears outdated producer rows after edits, including when installed after an edit, until recompilation succeeds', async () => {
	const test = await setup();
	test.select(5);
	expect(test.render()).toHaveLength(2);
	applyCodeBlockSourceEdits(
		test,
		[{ codeBlock: test.block, code: [...test.block.code.slice(0, 1), '; inserted', ...test.block.code.slice(1)] }],
		{ affectsCompilation: true }
	);
	expect(test.render()).toEqual([]);
	test.reinstall();
	test.select(6);
	expect(test.render()).toEqual([]);
	test.store.set('compiler.resultInputRevision', test.state.compilerInputRevision);
	const updated = await compileProject(
		parseProjectSource(`8f4e/v1\nentry main\n${test.block.code.join('\n')}\nentryEnd`),
		{ includeStackAnalysis: true }
	);
	test.store.set('compiler.result', updated);
	test.store.set('compiler.resultSourceCodeByBlockId', { [test.block.creationIndex]: [...test.block.code] });
	expect(test.render().map(([, y]) => y)).toEqual([64, 80]);
});

it('suppresses highlights when line selection is disabled and unregisters its background drawer', async () => {
	const test = await setup();
	test.select(5);
	expect(test.render()).toHaveLength(2);
	test.store.set('featureFlags.codeLineSelection', false);
	expect(test.render()).toEqual([]);
	test.store.set('featureFlags.codeLineSelection', true);
	expect(test.render()).toHaveLength(2);
	test.disposeProducers();
	expect(test.render()).toEqual([]);
});

it('isolates producer state between editors', async () => {
	const first = await setup();
	const second = await setup();
	first.select(3);
	second.select(5);
	expect(first.render().map(([, y]) => y)).toEqual([16, 32]);
	expect(second.render().map(([, y]) => y)).toEqual([48, 64]);
});

it('remaps producer rows across favorite and position edits without recompilation', async () => {
	const test = await setup();
	test.select(5);
	expect(test.render()).toHaveLength(2);
	const original = [...test.block.code];
	const revision = test.state.compilerInputRevision;
	applyCodeBlockSourceEdits(
		test,
		[{ codeBlock: test.block, code: [original[0], '; @favorite', ...original.slice(1)] }],
		{ affectsCompilation: false }
	);
	expect(test.state.compilerInputRevision).toBe(revision);
	test.select(6);
	expect(test.render().map(([, y]) => y)).toEqual([64, 80]);
	test.reinstall();
	expect(test.render().map(([, y]) => y)).toEqual([64, 80]);
	applyCodeBlockSourceEdits(
		test,
		[{ codeBlock: test.block, code: [original[0], '; @pos 20 5', '; @favorite', ...original.slice(1)] }],
		{ affectsCompilation: false }
	);
	test.select(7);
	expect(test.render().map(([, y]) => y)).toEqual([80, 96]);
	applyCodeBlockSourceEdits(test, [{ codeBlock: test.block, code: original }], { affectsCompilation: false });
	test.select(5);
	expect(test.render()).toHaveLength(2);
});

it('draws one highlight when two consumed values come from the same call', async () => {
	const test = await setup('module', ['call pair', 'add'], 'function pair\npush 2\npush 3\nfunctionEnd int int');
	test.select(2);
	expect(test.render().map(([, y]) => y)).toEqual([16]);
});
