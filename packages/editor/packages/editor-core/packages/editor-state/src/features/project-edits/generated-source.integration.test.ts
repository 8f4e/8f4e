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

it('ignores deletion, source edits and position changes to the read-only environment', () => {
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

	expect(store.projectEdits.apply({ deletes: [environment] }, { history: 'checkpoint' }).changed).toBe(false);
	expect(
		store.projectEdits.apply(
			{ updates: [{ codeBlock: environment, code: ['constants renamed', 'constantsEnd'] }] },
			{ history: 'checkpoint' }
		).changed
	).toBe(false);
	expect(
		store.projectEdits.apply({ updates: [{ codeBlock: environment, code: ['incomplete', '; @pos 3 4'] }] }).changed
	).toBe(false);
	expect(root.blocks).toContain(environment);
	expect(environment).toMatchObject({ readOnly: true, name: 'env', gridX: 0, gridY: 0, x: 0, y: 0 });
	expect(environment.code).toContain('; @pos 0 0');
	expect(environment.code).toBe(source);
	expect(environment.lastUpdated).toBe(timestamp);
	expect(state.projectChange.revision).toBe(projectRevision);
	expect(state.compilerInputRevision).toBe(compilerRevision);
	expect(beforeCheckpoint).not.toHaveBeenCalled();
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
	expect(authored.readOnly).not.toBe(true);
	store.set('envConstantContributions.test', ['const TEST 2']);
	expect(authored.code).toEqual(authoredCode);
	expect(environment.code).toContain('const TEST 2');
	expect(store.projectEdits.apply({ deletes: [authored] }).changed).toBe(true);
	expect(root.blocks).toContain(environment);
});

it('keeps a copied environment source editable until reopening normalizes duplicate root env blocks', () => {
	const { state, store, events, load } = setup();
	store.set('envConstantContributions.test', ['const GENERATED 1']);
	load('constants env\n; @pos 7 9\nconstantsEnd');
	const root = state.codeBlockRendering.rootProject;
	const environment = root.blocks[0];
	const copy = environment.code.map(line => (line.startsWith('; @pos') ? '; @pos -10 -10' : line));
	const {
		insertedBlocks: [authored],
	} = store.projectEdits.apply({ inserts: [{ project: root, source: { code: copy } }] });
	expect(authored.code).toEqual(copy);
	const edited = copy.map(line => (line === 'const GENERATED 1' ? 'const KEEP 2' : line));
	store.projectEdits.apply({ updates: [{ codeBlock: authored, code: edited }] });
	expect(authored.code).toEqual(edited);
	expect(environment.code).toContain('const GENERATED 1');
	events.dispatch('loadProject', { project: serializeToProject(state) });
	store.set('envConstantContributions.test', ['const GENERATED 3']);
	const restored = state.codeBlockRendering.rootProject.blocks;
	expect(restored).toHaveLength(1);
	expect(restored[0]).toMatchObject({ name: 'env', gridX: 0, gridY: 0, readOnly: true });
	expect(restored[0].code).toContain('const GENERATED 3');
	expect(restored[0].code).not.toContain('const KEEP 2');
	const generatedId = restored[0].creationIndex;
	events.dispatch('loadProject', { project: serializeToProject(state) });
	expect(state.codeBlockRendering.rootProject.blocks[0].creationIndex).toBe(generatedId);
});

const generatedHeader = '; Auto-generated environment constants\n; Changes will be overwritten\n';

it.each(['', generatedHeader])('replaces a sole root env when opening (%j)', header => {
	const { state, store, events } = setup();
	const project = parseProjectSource(`8f4e/v1\nconstants env\n; @pos -5 9\n${header}const OLD 1\nconstantsEnd`);
	store.set('envConstantContributions.test', ['const GENERATED 3']);
	events.dispatch('loadProject', { project });
	const blocks = state.codeBlockRendering.rootProject.blocks;
	expect(blocks).toHaveLength(1);
	expect(blocks[0]).toMatchObject({ name: 'env', gridX: 0, gridY: 0, readOnly: true });
	expect(blocks[0].code).toContain('const GENERATED 3');
	expect(blocks[0].code).not.toContain('const OLD 1');
});

it.each([
	['', ''],
	[generatedHeader, ''],
	['', generatedHeader],
	[generatedHeader, generatedHeader],
] as const)('replaces duplicate root env blocks regardless of their headers (%j, %j)', (leftHeader, rightHeader) => {
	const { state, store, events } = setup();
	const project = parseProjectSource(`8f4e/v1
constants env
; @pos -10 0
${leftHeader}const LEFT 1
constantsEnd
constants env
; @pos 10 0
${rightHeader}const RIGHT 2
constantsEnd
constants keep
const OUTSIDE 4
constantsEnd
entry main
group child
constants env
const NESTED 5
constantsEnd
groupEnd
entryEnd`);
	const originalConstants = project.constants.map(block => ({ id: block.id, code: [...block.code] }));
	store.set('envConstantContributions.test', ['const GENERATED 3']);
	events.dispatch('loadProject', { project });
	const blocks = state.codeBlockRendering.rootProject.blocks;
	const environments = blocks.filter(block => block.name === 'env' && block.blockType === 'constants');
	expect(environments).toHaveLength(1);
	const [generated] = environments;
	expect(generated).toMatchObject({ gridX: 0, gridY: 0, readOnly: true });
	expect(generated.code).toContain('const GENERATED 3');
	expect(generated.code).not.toContain('const LEFT 1');
	expect(generated.code).not.toContain('const RIGHT 2');
	expect(blocks.find(block => block.name === 'keep')?.code).toContain('const OUTSIDE 4');
	const nested = blocks.find(block => block.name === 'child')?.childProject?.blocks;
	expect(nested).toHaveLength(1);
	expect(nested?.[0].readOnly).not.toBe(true);
	expect(nested?.[0].code).toEqual(['constants env', 'const NESTED 5', 'constantsEnd']);
	expect(generated.creationIndex).toBeGreaterThan(
		Math.max(...blocks.filter(block => block !== generated).map(block => block.creationIndex), nested![0].creationIndex)
	);
	expect(project.constants.map(block => ({ id: block.id, code: block.code }))).toEqual(originalConstants);
});

it('derives the final generated source only once when authored config changes', () => {
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
		updates: [{ codeBlock: settings, code: ['note settings', '; @config test 20', 'noteEnd'] }],
	});
	expect(result.changed).toBe(true);
	expect(environment.code).toContain('const TEST 20');
	expect(environment.code).toContain('; @pos 0 0');
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
