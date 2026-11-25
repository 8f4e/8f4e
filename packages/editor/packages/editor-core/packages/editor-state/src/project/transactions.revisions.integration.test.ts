import type { InternalPointerEvent } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFifoEventDispatcher } from '~/__tests__/helpers/fifoEventDispatcher';
import initState, {
	applyCodeBlockSourceEdits,
	deleteCodeBlocks,
	insertCodeBlocks,
	sameProjectSnapshot,
	setGridSize,
} from '~/index';
import { createSchemaEditorConfigValidator } from '../editor-config/schemaValidator';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

const mainSource = 'entry main\nmodule main\npush 1\ndrop\nmoduleEnd\nentryEnd';

function setup() {
	const events = createFifoEventDispatcher();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const onInputChanged = vi.fn();
	store.subscribe('compilerInputRevision', onInputChanged);
	cleanups.push(store.dispose);
	setGridSize(state, events, { vGrid: 8, hGrid: 16 });
	events.dispatch('resize', { canvasWidth: 800, canvasHeight: 600 });
	const block = (name: string) => state.project.activeLevel.blocks.find(block => block.name === name)!;
	const load = (source = mainSource) => {
		events.dispatch('loadProject', {
			project: parseProjectSource(`8f4e/v1\nconstants env\n; @pos -100 -100\nconstantsEnd\n${source}`),
		});
		events.dispatch('enterEditMode');
		onInputChanged.mockClear();
	};
	const expectChanges = (n: number) => {
		expect(state.projectChange.revision).toBe(1 + n);
		expect(state.compilerInputRevision).toBe(1 + n);
		expect(onInputChanged).toHaveBeenCalledTimes(n);
	};
	return { store, state, events, block, load, expectChanges, onInputChanged };
}

function pointer(overrides: Partial<InternalPointerEvent> = {}): InternalPointerEvent {
	return {
		x: 32,
		y: 8,
		movementX: 0,
		movementY: 0,
		buttons: 1,
		stopPropagation: false,
		canvasWidth: 800,
		canvasHeight: 600,
		altKey: false,
		...overrides,
	};
}

describe('project and compiler input revisions', () => {
	it('start at zero before loading a project', () => {
		const { state, onInputChanged } = setup();
		expect(state.projectChange.revision).toBe(0);
		expect(state.compilerInputRevision).toBe(0);
		expect(onInputChanged).not.toHaveBeenCalled();
	});

	it('announce changed source batches and ignore identical source', () => {
		const { store, block, load, expectChanges } = setup();
		load();
		const main = block('main');
		const sources: string[][] = [];
		store.subscribe('compilerInputRevision', () => sources.push([...main.code]));
		const code = ['module main', 'push 12', 'drop', 'moduleEnd'];
		applyCodeBlockSourceEdits(store, [{ codeBlock: main, code }]);
		expectChanges(1);
		expect(sources).toEqual([code]);
		applyCodeBlockSourceEdits(store, [{ codeBlock: main, code: [...code] }]);
		expectChanges(1);
	});

	it('ignore mouse selection, line selection, caret movement, and block navigation', () => {
		const { store, state, events, block, load, expectChanges } = setup();
		load('entry main\nmodule main\npush 1\ndrop\nmoduleEnd\nmodule target\n; @pos 50 0\nmoduleEnd\nentryEnd');
		const main = block('main');
		const target = block('target');
		events.dispatch('pointerdown', pointer());
		events.dispatch('pointerup', pointer({ buttons: 0 }));
		events.dispatch('pointerdown', pointer({ y: 24 }));
		events.dispatch('pointerup', pointer({ buttons: 0 }));
		expect(main.cursor.row).toBe(1);
		store.set('project.selectedCodeBlock.cursor.row', 2);
		events.dispatch('navigateCodeBlock', { direction: 'right' });
		expect(state.project.selectedCodeBlock).toBe(target);
		expectChanges(0);

		applyCodeBlockSourceEdits(store, [{ codeBlock: target, code: ['module target', '; edited', 'moduleEnd'] }]);
		expectChanges(1);
	});

	it('advance once for a saved drag position and settle its directives', () => {
		const { store, state, events, block, load, expectChanges } = setup();
		store.set(
			'editorConfigValidators.example',
			createSchemaEditorConfigValidator({ root: 'example', schema: { type: 'integer' } })
		);
		load('entry main\nmodule main\n; @pos 0 0\n; @config example 120\npush 1\ndrop\nmoduleEnd\nentryEnd');
		const main = block('main');
		events.dispatch('pointerdown', pointer());
		events.dispatch('pointermove', pointer({ movementX: 16, movementY: 32 }));
		events.dispatch('pointerup', pointer({ buttons: 0 }));
		expect(main.code).toContain('; @pos 2 2');
		expect(main.parsedDirectives).toContainEqual(expect.objectContaining({ name: 'pos', args: ['2', '2'] }));
		expect(main).toMatchObject({ gridX: 2, gridY: 2 });
		expect(state.editorConfig.example).toBe(120);
		expectChanges(1);
	});

	it('advance after adding, disabling, enabling and deleting, but not for repeated deletion', () => {
		const { store, events, block, load, expectChanges } = setup();
		load();
		const main = block('main');
		events.dispatch('insertCodeBlock', { x: 100, y: 100, code: ['module added', 'moduleEnd'] });
		expectChanges(1);
		const enabledSource = [...main.code];
		applyCodeBlockSourceEdits(store, [
			{ codeBlock: main, code: ['module main', '; @disabled', ...enabledSource.slice(1)] },
		]);
		expect(main.disabled).toBe(true);
		expectChanges(2);
		applyCodeBlockSourceEdits(store, [{ codeBlock: main, code: enabledSource }]);
		expect(main.disabled).toBe(false);
		expectChanges(3);
		deleteCodeBlocks(store, [main]);
		expectChanges(4);
		deleteCodeBlocks(store, [main]);
		expectChanges(4);
	});

	it('advance once for a block batch and ignore an empty batch', () => {
		const { store, state, load, expectChanges } = setup();
		load();
		const blocks = ['one', 'two'].map(name => ({
			code: [`module ${name}`, 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		}));
		insertCodeBlocks(store, { x: 0, y: 0, blocks });
		expect(state.project.activeLevel.blocks).toHaveLength(4);
		expectChanges(1);
		insertCodeBlocks(store, { x: 0, y: 0, blocks: [] });
		expectChanges(1);
	});

	it('advance for regenerated environment constants and ignore identical regeneration', () => {
		const { store, state, block, load, expectChanges } = setup();
		load();
		store.set('envConstantContributions.test', ['const CONTRIBUTED_VALUE 100']);
		expect(block('env').code).toContain('const CONTRIBUTED_VALUE 100');
		expectChanges(1);
		store.set('envConstantContributions', state.envConstantContributions);
		expectChanges(1);
	});

	it('ignore opening and leaving a nested project but advance for edits inside it', () => {
		const { store, state, events, block, load, expectChanges } = setup();
		load('entry main\ngroup Audio\nentry main\nmodule child\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd');
		events.dispatch('openProjectGroup', { codeBlock: block('Audio') });
		const child = block('child');
		store.set('project.selectedCodeBlock', child);
		expectChanges(0);
		applyCodeBlockSourceEdits(store, [{ codeBlock: child, code: ['module child', '; edited', 'moduleEnd'] }]);
		expectChanges(1);
		events.dispatch('goToParentProjectGroup');
		expect(state.project.activeLevel.blocks).toBe(state.project.rootLevel.blocks);
		expectChanges(1);
	});

	it('announce project loading and snapshot restoration without requiring a selected block', () => {
		const { store, state, block, load, expectChanges } = setup();
		load();
		expect(state.project.selectedCodeBlock).toBeUndefined();
		expect(state.projectChange).toEqual({ revision: 1, kind: 'replace' });
		expectChanges(0);
		const original = store.projectTransactions.capture();
		applyCodeBlockSourceEdits(store, [
			{ codeBlock: block('main'), code: ['module main', 'push 2', 'drop', 'moduleEnd'] },
		]);
		expectChanges(1);
		const edited = store.projectTransactions.capture();
		store.projectTransactions.restore(original);
		expect(block('main').code).toContain('push 1');
		expectChanges(2);
		store.projectTransactions.restore(edited);
		expect(block('main').code).toContain('push 2');
		expectChanges(3);
	});

	it('compares authored snapshots without treating allocation as a source difference', () => {
		const { store, state, load } = setup();
		load();
		const original = store.projectTransactions.capture();
		const { insertedBlocks } = store.projectTransactions.apply({
			inserts: [{ targetLevel: state.project.rootLevel, source: { code: ['note temporary', 'noteEnd'] } }],
		});
		expect(sameProjectSnapshot(original, store.projectTransactions.capture())).toBe(false);
		deleteCodeBlocks(store, insertedBlocks);
		const current = store.projectTransactions.capture();
		expect(current.nextCodeBlockCreationIndex).toBeGreaterThan(original.nextCodeBlockCreationIndex);
		expect(sameProjectSnapshot(original, current)).toBe(true);
	});
});
