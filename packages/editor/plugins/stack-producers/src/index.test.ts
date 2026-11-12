import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
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
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'test')!;
	store.set('compiler.result', {
		...compiled,
		inputRevision: state.compilerInputRevision,
	});
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
	let disposeProducers = stackProducersPlugin.setup(context);
	const draw = { drawFill: vi.fn<DrawContext['drawFill']>() };
	const drawBackground = () => {
		draw.drawFill.mockClear();
		drawers.drawCodeBlockTextBackgrounds({
			draw: draw as unknown as DrawContext,
			state,
			codeBlock: block,
			memoryViews: {} as MemoryViews,
		});
		return draw.drawFill.mock.calls;
	};
	const select = (row: number) => {
		store.set('codeBlockRendering.selectedCodeBlock', block);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', row);
	};
	cleanups.push(() => {
		disposeProducers();
		store.dispose();
	});
	return {
		store,
		state,
		block,
		events,
		select,
		drawBackground,
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
		expect(test.drawBackground().map(([, y]) => y)).toEqual([48, 64]);
		test.select(3);
		expect(test.drawBackground().map(([, y]) => y)).toEqual([16, 32]);
		test.select(1);
		expect(test.drawBackground()).toEqual([]);
		test.store.set('codeBlockRendering.selectedCodeBlock', undefined);
		expect(test.drawBackground()).toEqual([]);
	}
);

it('prepares coordinates from settled gaps, block width, and grid dimensions', async () => {
	const test = await setup();
	test.select(5);
	const contribution = test.store.layout.createContribution();
	cleanups.push(contribution.dispose);
	contribution.update(test.block, {
		verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }],
		minGridWidth: 40,
	});
	expect(test.drawBackground()).toEqual([
		[0, 80, PALETTE_INDICES.secondaryAlpha30, test.block.width, 16],
		[0, 96, PALETTE_INDICES.secondaryAlpha30, test.block.width, 16],
	]);
	test.state.viewport.hGrid = 20;
	test.events.dispatch('gridSizeChanged');
	expect(test.drawBackground().map(([, y]) => y)).toEqual([100, 120]);
});

it('clears outdated producer rows after edits, including when installed after an edit, until recompilation succeeds', async () => {
	const test = await setup();
	test.select(5);
	expect(test.drawBackground()).toHaveLength(2);
	applyCodeBlockSourceEdits(
		test,
		[{ codeBlock: test.block, code: [...test.block.code.slice(0, 1), '; inserted', ...test.block.code.slice(1)] }],
		{ affectsCompilation: true }
	);
	expect(test.drawBackground()).toEqual([]);
	test.reinstall();
	test.select(6);
	expect(test.drawBackground()).toEqual([]);
	const updated = await compileProject(
		parseProjectSource(`8f4e/v1\nentry main\n${test.block.code.join('\n')}\nentryEnd`),
		{ includeStackAnalysis: true }
	);
	test.store.set('compiler.result', {
		...updated,
		inputRevision: test.state.compilerInputRevision,
	});
	expect(test.drawBackground().map(([, y]) => y)).toEqual([64, 80]);
});

it('suppresses highlights when line selection is disabled and unregisters its background drawer', async () => {
	const test = await setup();
	test.select(5);
	expect(test.drawBackground()).toHaveLength(2);
	test.store.set('featureFlags.codeLineSelection', false);
	expect(test.drawBackground()).toEqual([]);
	test.store.set('featureFlags.codeLineSelection', true);
	expect(test.drawBackground()).toHaveLength(2);
	test.disposeProducers();
	expect(test.drawBackground()).toEqual([]);
});

it('isolates producer state between editors', async () => {
	const first = await setup();
	const second = await setup();
	first.select(3);
	second.select(5);
	expect(first.drawBackground().map(([, y]) => y)).toEqual([16, 32]);
	expect(second.drawBackground().map(([, y]) => y)).toEqual([48, 64]);
});

it('draws one highlight when two consumed values come from the same call', async () => {
	const test = await setup('module', ['call pair', 'add'], 'function pair\npush 2\npush 3\nfunctionEnd int int');
	test.select(2);
	expect(test.drawBackground().map(([, y]) => y)).toEqual([16]);
});
