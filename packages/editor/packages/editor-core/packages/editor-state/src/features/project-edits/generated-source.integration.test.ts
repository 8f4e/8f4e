import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, expect, it, vi } from 'vitest';
import initState, { serializeToProject, setGridSize } from '~/index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, {
		callbacks: {},
		editorConfigSchemaContributions: { test: { root: 'test', schema: { type: 'integer' } } },
	});
	const state = store.getState();
	cleanups.push(store.dispose);
	setGridSize(state, events, { vGrid: 6, hGrid: 12 });
	const load = (source: string) =>
		events.dispatch('loadProject', { project: parseProjectSource(`8f4e/v1\n${source}`) });
	return { state, store, events, load };
}

it('retains managed environment identity on attempted deletion or rename, and accepts only its position', () => {
	const { state, store, events, load } = setup();
	load('constants env\n; @pos 7 9\nconstantsEnd');
	const root = state.codeBlockRendering.rootProject;
	const environment = root.blocks[0];
	const source = environment.code;
	const timestamp = environment.lastUpdated;
	const projectRevision = state.projectChange.revision;
	const compilerRevision = state.compilerInputRevision;
	const beforeCheckpoint = vi.fn();
	events.on('beforeProjectEdit', beforeCheckpoint);

	expect(store.projectEdits.apply({ deletes: [environment] }, 'checkpoint').changed).toBe(false);
	expect(
		store.projectEdits.apply(
			{ updates: [{ codeBlock: environment, code: ['constants renamed', 'constantsEnd'] }] },
			'checkpoint'
		).changed
	).toBe(false);
	expect(root.blocks).toContain(environment);
	expect(environment.code).toBe(source);
	expect(environment.lastUpdated).toBe(timestamp);
	expect(state.projectChange.revision).toBe(projectRevision);
	expect(state.compilerInputRevision).toBe(compilerRevision);
	expect(beforeCheckpoint).not.toHaveBeenCalled();

	expect(
		store.projectEdits.apply({ updates: [{ codeBlock: environment, code: ['incomplete', '; @pos 3 4'] }] }).changed
	).toBe(true);
	expect(root.blocks).toContain(environment);
	expect(environment.name).toBe('env');
	expect(environment.code).toContain('constants env');
	expect(environment.code).toContain('; @pos 3 4');
	expect(environment).toMatchObject({ gridX: 3, gridY: 4, x: 18, y: 48 });
});

it('keeps an authored duplicate name editable instead of transferring generated source ownership', () => {
	const { state, store, load } = setup();
	load('constants env\n; @pos 7 9\nconstantsEnd');
	const root = state.codeBlockRendering.rootProject;
	const environment = root.blocks[0];
	const authoredCode = ['constants env', '; @pos -1 -1', 'const KEEP 1', 'constantsEnd'];
	const {
		insertedBlocks: [authored],
	} = store.projectEdits.apply({ inserts: [{ project: root, source: { code: authoredCode } }] });
	store.set('envConstantContributions.test', ['const TEST 2']);
	expect(authored.code).toEqual(authoredCode);
	expect(environment.code).toContain('const TEST 2');
	expect(store.projectEdits.apply({ deletes: [authored] }).changed).toBe(true);
	expect(root.blocks).toContain(environment);
});

it('keeps the generated ownership header exclusive when root environment source is copied or edited', () => {
	const { state, store, events, load } = setup();
	store.set('envConstantContributions.test', ['const GENERATED 1']);
	load('constants env\n; @pos 7 9\nconstantsEnd');
	const root = state.codeBlockRendering.rootProject;
	const environment = root.blocks[0];
	const copy = environment.code.map(line => (line.startsWith('; @pos') ? '; @pos -10 -10' : line));
	const {
		insertedBlocks: [authored],
	} = store.projectEdits.apply({ inserts: [{ project: root, source: { code: copy } }] });
	expect(authored.code).toContain('const GENERATED 1');
	expect(authored.code).not.toContain('; Auto-generated environment constants');
	expect(authored.code).not.toContain('; Changes will be overwritten');
	const edited = copy.map(line => (line === 'const GENERATED 1' ? 'const KEEP 2' : line));
	store.projectEdits.apply({ updates: [{ codeBlock: authored, code: edited }] });
	const authoredCode = authored.code;
	expect(authoredCode).toContain('const KEEP 2');
	expect(authoredCode).not.toContain('; Auto-generated environment constants');
	events.dispatch('loadProject', { project: serializeToProject(state) });
	store.set('envConstantContributions.test', ['const GENERATED 3']);
	const restored = state.codeBlockRendering.rootProject.blocks;
	expect(restored.find(block => block.code.includes('const KEEP 2'))?.code).toEqual(authoredCode);
	expect(restored.find(block => block.code.includes('const GENERATED 3'))).toMatchObject({ gridX: 7, gridY: 9 });
});

it.each(['', '; Auto-generated environment constants\n; Changes will be overwritten\n'])(
	'preserves authored environment blocks when the loaded source has ambiguous ownership (%j)',
	header => {
		const { state, store, load } = setup();
		load(
			`constants env\n; @pos -10 0\n${header}const LEFT 1\nconstantsEnd\nconstants env\n; @pos 10 0\n${header}const RIGHT 2\nconstantsEnd`
		);
		const blocks = state.codeBlockRendering.rootProject.blocks;
		expect(blocks).toHaveLength(3);
		const left = blocks.find(block => block.code.includes('const LEFT 1'))!;
		const right = blocks.find(block => block.code.includes('const RIGHT 2'))!;
		const generated = blocks.find(block => block.code.includes('; Auto-generated environment constants'))!;
		store.set('envConstantContributions.test', ['const GENERATED 3']);
		expect(left.code).toContain('const LEFT 1');
		expect(right.code).toContain('const RIGHT 2');
		expect(left.code).not.toContain('; Auto-generated environment constants');
		expect(right.code).not.toContain('; Auto-generated environment constants');
		expect(generated.code).toContain('const GENERATED 3');
	}
);

it('derives the final generated source only once when authored config and its position change together', () => {
	const { state, store, load } = setup();
	const derive = vi.fn();
	cleanups.push(store.directives.register({ name: 'custom', apply: derive }));
	store.set('envConstantContributions.test', ['; @custom']);
	store.subscribe('editorConfig.test', () => {
		store.set('envConstantContributions.test', ['; @custom', `const TEST ${state.editorConfig.test}`]);
	});
	load('note settings\n; @config test 10\nnoteEnd');
	expect(derive).toHaveBeenCalledOnce();
	const root = state.codeBlockRendering.rootProject;
	const environment = root.blocks.find(block => block.name === 'env')!;
	const settings = root.blocks.find(block => block.name === 'settings')!;
	derive.mockClear();
	const result = store.projectEdits.apply({
		updates: [
			{ codeBlock: settings, code: ['note settings', '; @config test 20', 'noteEnd'] },
			{ codeBlock: environment, code: ['constants env', '; @pos 4 5', 'constantsEnd'] },
		],
	});
	expect(result.changed).toBe(true);
	expect(environment.code).toContain('const TEST 20');
	expect(environment.code).toContain('; @pos 4 5');
	expect(derive).toHaveBeenCalledOnce();
});

it('preserves authored entry tables when inserting, changing and removing execution blocks', () => {
	const { state, store, load } = setup();
	load('entry empty\nentryEnd\nentry main\nmodule demo\nmoduleEnd\nentryEnd');
	const root = state.codeBlockRendering.rootProject;
	const existing = root.blocks.find(block => block.name === 'demo')!;
	const {
		insertedBlocks: [inserted],
	} = store.projectEdits.apply({
		inserts: [{ project: root, source: { code: ['module inserted', 'moduleEnd'], entry: 'new' } }],
	});
	expect(root.entries).toEqual(['empty', 'main', 'new']);
	store.projectEdits.apply({ updates: [{ codeBlock: existing, entry: 'other' }], deletes: [inserted] });
	expect(root.entries).toEqual(['empty', 'main', 'new', 'other']);
	expect(serializeToProject(state).entries).toEqual(root.entries);
});

it('checks attached project targets before any live source change or identity allocation', () => {
	const { state, store, load } = setup();
	load('note old\nnoteEnd');
	const staleProject = state.codeBlockRendering.rootProject;
	const staleBlock = staleProject.blocks.find(block => block.name === 'old')!;
	load('note keep\nnoteEnd\nentry main\ngroup child\nnote nested\nnoteEnd\ngroupEnd\nentryEnd');
	const root = state.codeBlockRendering.rootProject;
	const keep = root.blocks.find(block => block.name === 'keep')!;
	const group = root.blocks.find(block => block.name === 'child')!;
	const originalSource = keep.code;
	const revision = state.projectChange.revision;
	const compilerRevision = state.compilerInputRevision;
	const nextId = state.codeBlockRendering.nextCodeBlockCreationIndex;
	const update = { codeBlock: keep, code: ['note modified', 'noteEnd'] };
	const newSource = { code: ['note added', 'noteEnd'] };

	expect(() =>
		store.projectEdits.apply({ updates: [update, { codeBlock: staleBlock, code: ['note stale'] }] })
	).toThrow();
	expect(() =>
		store.projectEdits.apply({ updates: [update], inserts: [{ project: staleProject, source: newSource }] })
	).toThrow();
	expect(() =>
		store.projectEdits.apply({
			updates: [update],
			deletes: [group],
			inserts: [{ project: group.childProject!, source: newSource }],
		})
	).toThrow();
	expect(keep.code).toBe(originalSource);
	expect(root.blocks).toContain(group);
	expect(state.codeBlockRendering.nextCodeBlockCreationIndex).toBe(nextId);
	expect(state.projectChange.revision).toBe(revision);
	expect(state.compilerInputRevision).toBe(compilerRevision);
});
