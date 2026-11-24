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
	const root = state.project.rootLevel;
	const environment = root.blocks[0];
	const source = environment.code;
	const timestamp = environment.lastUpdated;
	const projectRevision = state.projectChange.revision;
	const compilerRevision = state.compilerInputRevision;
	const beforeCheckpoint = vi.fn();
	events.on('beforeProjectEdit', beforeCheckpoint);

	expect(store.projectTransactions.apply({ deletes: [environment] }, { history: 'checkpoint' }).changed).toBe(false);
	expect(
		store.projectTransactions.apply(
			{ updates: [{ codeBlock: environment, code: ['constants renamed', 'constantsEnd'] }] },
			{ history: 'checkpoint' }
		).changed
	).toBe(false);
	expect(
		store.projectTransactions.apply({ updates: [{ codeBlock: environment, code: ['incomplete', '; @pos 3 4'] }] })
			.changed
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

it('ignores authored attempts to insert or rename a root constants env without invalidating history', () => {
	const { state, store, events, load } = setup();
	store.set('envConstantContributions.test', ['const GENERATED 1']);
	load('constants keep\nconst KEEP 2\nconstantsEnd');
	const root = state.project.rootLevel;
	const environment = root.blocks[0];
	const authored = root.blocks.find(block => block.name === 'keep')!;
	const copy = environment.code.map(line => (line.startsWith('; @pos') ? '; @pos -10 -10' : line));
	const revision = state.projectChange.revision;
	const compilerRevision = state.compilerInputRevision;
	const nextId = state.project.nextCodeBlockCreationIndex;
	const beforeCheckpoint = vi.fn();
	events.on('beforeProjectEdit', beforeCheckpoint);
	expect(
		store.projectTransactions.apply(
			{ inserts: [{ project: root, source: { code: copy } }], updates: [{ codeBlock: authored, code: copy }] },
			{ history: 'checkpoint' }
		)
	).toEqual({ changed: false, insertedBlocks: [] });
	expect(authored.code).toEqual(['constants keep', 'const KEEP 2', 'constantsEnd']);
	expect(root.blocks).toHaveLength(2);
	expect(state.projectChange.revision).toBe(revision);
	expect(state.compilerInputRevision).toBe(compilerRevision);
	expect(state.project.nextCodeBlockCreationIndex).toBe(nextId);
	expect(beforeCheckpoint).not.toHaveBeenCalled();
	store.set('envConstantContributions.test', ['const GENERATED 3']);
	expect(environment.code).toContain('const GENERATED 3');
	expect(serializeToProject(state).constants.filter(block => block.code[0] === 'constants env')).toHaveLength(1);
	const generatedId = environment.creationIndex;
	events.dispatch('loadProject', { project: serializeToProject(state) });
	expect(state.project.rootLevel.blocks[0].creationIndex).toBe(generatedId);
});

it('continues to allow constants env in child projects and ordinary authored names at the root', () => {
	const { state, store, load } = setup();
	load('entry main\ngroup child\ngroupEnd\nentryEnd');
	const root = state.project.rootLevel;
	const child = root.blocks.find(block => block.name === 'child')!.childProject!;
	const {
		insertedBlocks: [nested, note, constants],
	} = store.projectTransactions.apply({
		inserts: [
			{ project: child, source: { code: ['constants env', 'const NESTED 1', 'constantsEnd'] } },
			{ project: root, source: { code: ['note env', 'noteEnd'] } },
			{ project: root, source: { code: ['constants environment', 'const ROOT 1', 'constantsEnd'] } },
		],
	});
	expect(nested.readOnly).not.toBe(true);
	expect(note).toMatchObject({ blockType: 'note', name: 'env' });
	expect(constants).toMatchObject({ blockType: 'constants', name: 'environment' });
	expect(
		store.projectTransactions.apply({
			updates: [
				{ codeBlock: nested, code: ['constants env', 'const NESTED 2', 'constantsEnd'] },
				{ codeBlock: note, code: ['note env', '; authored', 'noteEnd'] },
				{ codeBlock: constants, code: ['constants environment', 'const ROOT 2', 'constantsEnd'] },
			],
		}).changed
	).toBe(true);
	expect(nested.code).toContain('const NESTED 2');
	expect(note.code).toContain('; authored');
	expect(constants.code).toContain('const ROOT 2');
});

const generatedHeader = '; Auto-generated environment constants\n; Changes will be overwritten\n';

it.each(['', generatedHeader])('replaces a sole root env when opening (%j)', header => {
	const { state, store, events } = setup();
	const project = parseProjectSource(`8f4e/v1\nconstants env\n; @pos -5 9\n${header}const OLD 1\nconstantsEnd`);
	store.set('envConstantContributions.test', ['const GENERATED 3']);
	events.dispatch('loadProject', { project });
	const blocks = state.project.rootLevel.blocks;
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
	const blocks = state.project.rootLevel.blocks;
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
	const root = state.project.rootLevel;
	const environment = root.blocks.find(block => block.name === 'env')!;
	const settings = root.blocks.find(block => block.name === 'settings')!;
	derive.mockClear();
	const result = store.projectTransactions.apply({
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
	const root = state.project.rootLevel;
	const existing = root.blocks.find(block => block.name === 'demo')!;
	const {
		insertedBlocks: [inserted],
	} = store.projectTransactions.apply({
		inserts: [{ project: root, source: { code: ['module inserted', 'moduleEnd'], entry: 'new' } }],
	});
	expect(root.entries).toEqual(['empty', 'main', 'new']);
	store.projectTransactions.apply({ updates: [{ codeBlock: existing, entry: 'other' }], deletes: [inserted] });
	expect(root.entries).toEqual(['empty', 'main', 'new', 'other']);
	expect(serializeToProject(state).entries).toEqual(root.entries);
});

it('checks attached project targets before any live source change or identity allocation', () => {
	const { state, store, load } = setup();
	load('note old\nnoteEnd');
	const staleProject = state.project.rootLevel;
	const staleBlock = staleProject.blocks.find(block => block.name === 'old')!;
	load('note keep\nnoteEnd\nentry main\ngroup child\nnote nested\nnoteEnd\ngroupEnd\nentryEnd');
	const root = state.project.rootLevel;
	const keep = root.blocks.find(block => block.name === 'keep')!;
	const group = root.blocks.find(block => block.name === 'child')!;
	const originalSource = keep.code;
	const revision = state.projectChange.revision;
	const compilerRevision = state.compilerInputRevision;
	const nextId = state.project.nextCodeBlockCreationIndex;
	const update = { codeBlock: keep, code: ['note modified', 'noteEnd'] };
	const newSource = { code: ['note added', 'noteEnd'] };

	expect(() =>
		store.projectTransactions.apply({ updates: [update, { codeBlock: staleBlock, code: ['note stale'] }] })
	).toThrow();
	expect(() =>
		store.projectTransactions.apply({ updates: [update], inserts: [{ project: staleProject, source: newSource }] })
	).toThrow();
	expect(() =>
		store.projectTransactions.apply({
			updates: [update],
			deletes: [group],
			inserts: [{ project: group.childProject!, source: newSource }],
		})
	).toThrow();
	expect(keep.code).toBe(originalSource);
	expect(root.blocks).toContain(group);
	expect(state.project.nextCodeBlockCreationIndex).toBe(nextId);
	expect(state.projectChange.revision).toBe(revision);
	expect(state.compilerInputRevision).toBe(compilerRevision);
});
