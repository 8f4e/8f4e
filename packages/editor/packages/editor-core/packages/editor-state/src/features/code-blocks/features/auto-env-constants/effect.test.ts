import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { getProjectModules } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { applyCodeBlockSourceEdits, serializeToProject, setGridSize } from '~/index';

const disposers: Array<() => void> = [];
afterEach(() => {
	while (disposers.length) disposers.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	disposers.push(store.dispose);
	const state = store.getState();
	const load = (source: string) => events.dispatch('loadProject', { project: parseProjectSource(source) });
	const env = () =>
		state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'env' && block.blockType === 'constants')!;
	return { store, state, events, load, env };
}

describe('auto-managed root environment source', () => {
	it('normalizes a project without env once before publishing source and compiler inputs', () => {
		const { store, state, events, load, env } = setup();
		store.set('envConstantContributions.provider', ['const PROVIDED 50']);
		const apply = vi.fn<NonNullable<EditorDirectiveDefinition['apply']>>();
		disposers.push(store.directives.register({ name: 'sample', apply }));
		const onRootProject = vi.fn();
		const onCompilerInput = vi.fn(() => serializeToProject(state));
		store.subscribe('codeBlockRendering.rootProject', onRootProject);
		events.on('compilationInputChanged', onCompilerInput);

		load(`8f4e/v1
entry main
group child
entry main
module demo
; @sample
moduleEnd
entryEnd
groupEnd
entryEnd`);

		expect(apply).toHaveBeenCalledOnce();
		expect(onRootProject).toHaveBeenCalledOnce();
		expect(onCompilerInput).toHaveBeenCalledOnce();
		expect(state.projectChange).toEqual({ revision: 1, kind: 'replace' });
		expect(state.compilerInputRevision).toBe(1);
		expect(serializeToProject(state).constants[0]).toMatchObject({ code: env().code, id: env().creationIndex });
		expect(env().code).toContain('const PROVIDED 50');
		expect(env().code).toContain('; Auto-generated environment constants');
		expect(env().code).toContain('; @pos 0 0');
		expect(onCompilerInput.mock.results[0].value.constants[0].code).toEqual(env().code);
		const nested = state.codeBlockRendering.rootProject.blocks.find(block => block.childProject)!.childProject!
			.blocks[0];
		expect(env().creationIndex).toBeGreaterThan(nested.creationIndex);
	});

	it('replaces the saved env with a read-only block at the origin and fresh generated content', () => {
		const { store, state, events, env } = setup();
		store.set('envConstantContributions.provider', ['const PROVIDED 123']);
		const project = parseProjectSource(`8f4e/v1
constants env
; @pos 12 -7
; @disabled
const OBSOLETE 1
constantsEnd
entry main
module demo
moduleEnd
entryEnd`);
		const previousCode = [...project.constants[0].code];
		const onCompilerInput = vi.fn();
		events.on('compilationInputChanged', onCompilerInput);

		events.dispatch('loadProject', { project });

		expect(project.constants[0].code).toEqual(previousCode);
		expect(project.constants[0].disabled).toBe(true);
		const source = serializeToProject(state);
		expect(source.constants).toHaveLength(1);
		expect(source.constants[0]).toMatchObject({ id: env().creationIndex, code: env().code });
		expect(source.constants[0]).not.toHaveProperty('disabled');
		expect(env()).toMatchObject({ gridX: 0, gridY: 0, readOnly: true });
		expect(env().creationIndex).toBeGreaterThan(getProjectModules(source)[0].id);
		expect(env().disabled).toBe(false);
		expect(env().code).toContain('const PROVIDED 123');
		expect(env().code).not.toContain('const OBSOLETE 1');
		expect(getProjectModules(source)[0].code[0]).toBe('module demo');
		expect(onCompilerInput).toHaveBeenCalledOnce();
	});

	it('does not mistake other constants or module names for the environment block', () => {
		const { store, state, load, env } = setup();
		store.set('envConstantContributions.provider', ['const PROVIDED 42']);
		load(`8f4e/v1
constants environment
const KEEP 3
constantsEnd
entry main
module env
int keep 1
moduleEnd
entryEnd`);
		const source = serializeToProject(state);
		expect(source.constants).toHaveLength(2);
		expect(source.constants.find(block => block.code[0] === 'constants environment')?.code).toEqual([
			'constants environment',
			'const KEEP 3',
			'constantsEnd',
		]);
		expect(getProjectModules(source)[0].code).toEqual(['module env', 'int keep 1', 'moduleEnd']);
		expect(env().code).toContain('const PROVIDED 42');
	});

	it('keeps contributions in configured order and refreshes or removes them without changing position', () => {
		const { store, state, load, env } = setup();
		store.set('envConstantContributions', {
			first: ['const FIRST 1'],
			provider: ['const PROVIDED 50'],
			empty: [],
			second: ['; second provider', 'const SECOND 2'],
		});
		load('8f4e/v1\nconstants env\n; @pos 7 9\nconstantsEnd');
		expect(env().code.filter(line => line.startsWith('const '))).toEqual([
			'const FIRST 1',
			'const PROVIDED 50',
			'const SECOND 2',
		]);
		expect(env().code).toContain('; second provider');
		const original = env();
		store.set('envConstantContributions.provider', ['const PROVIDED 77']);
		expect(env()).toBe(original);
		expect(env().code).toContain('const PROVIDED 77');
		store.set('envConstantContributions', { provider: ['const PROVIDED 77'] });
		expect(env().code).not.toContain('const FIRST 1');
		expect(env().code).not.toContain('const SECOND 2');
		expect(env().code).toContain('; @pos 0 0');
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		store.set('envConstantContributions', { provider: ['const PROVIDED 77'] });
		expect(state.projectChange.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
	});

	it('leaves authored nested env blocks alone on navigation and refreshes the hidden root environment', () => {
		const { store, state, events, load, env } = setup();
		setGridSize(state, events, TEST_GRID_SIZE);
		load(`8f4e/v1
constants env
; @pos 7 9
constantsEnd
entry main
group child
constants env
const KEEP 3
constantsEnd
entry main
module env
int keep 1
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const rootEnvironment = env();
		const group = state.codeBlockRendering.rootProject.blocks.find(block => block.childProject)!;
		const authored = group.childProject!.blocks;
		const previousCode = authored.map(block => [...block.code]);
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		const onLayoutChanged = vi.fn();
		events.on('codeBlockLayoutsChanged', onLayoutChanged);

		events.dispatch('openProjectGroup', { codeBlock: group });
		expect(state.codeBlockRendering.currentProject).toBe(group.childProject);
		expect(authored.map(block => block.code)).toEqual(previousCode);
		expect(state.projectChange.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
		onLayoutChanged.mockClear();

		store.set('envConstantContributions.provider', ['const PROVIDED 77']);
		expect(authored.map(block => block.code)).toEqual(previousCode);
		expect(rootEnvironment.code).toContain('const PROVIDED 77');
		expect(rootEnvironment.code).toContain('; @pos 0 0');
		expect(onLayoutChanged).toHaveBeenCalledWith({
			project: state.codeBlockRendering.rootProject,
			codeBlocks: [rootEnvironment],
		});
		expect(state.projectChange.revision).toBe(revision + 1);
		expect(state.compilerInputRevision).toBe(compilerRevision + 1);

		events.dispatch('goToRootProjectGroup');
		expect(authored.map(block => block.code)).toEqual(previousCode);
		expect(state.projectChange.revision).toBe(revision + 1);
		expect(state.compilerInputRevision).toBe(compilerRevision + 1);
	});

	it('ignores attempted generated-source edits without publishing a project change', () => {
		const { store, state, load, env } = setup();
		load('8f4e/v1\nconstants env\n; @pos 7 9\nconstantsEnd');
		const onChanged = vi.fn();
		store.subscribe('projectChange', onChanged);
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;

		applyCodeBlockSourceEdits(store, [
			{ codeBlock: env(), code: ['constants env', '; @pos 12 15', 'const USER 5', 'constantsEnd'] },
		]);

		expect(env().code).not.toContain('const USER 5');
		expect(env().code).toContain('; @pos 0 0');
		expect(env()).toMatchObject({ gridX: 0, gridY: 0, readOnly: true });
		expect(onChanged).not.toHaveBeenCalled();
		expect(state.projectChange.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
	});

	it('retains the read-only environment and its current contributions during undo and redo', () => {
		const { store, state, events, load, env } = setup();
		load('8f4e/v1\nconstants env\n; @pos 7 9\nconstantsEnd\nentry main\nmodule authored\nmoduleEnd\nentryEnd');
		const environment = env();
		const authored = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'authored')!;
		store.projectEdits.apply(
			{ updates: [{ codeBlock: authored(), code: ['module authored', 'push 1', 'moduleEnd'] }] },
			{ history: 'checkpoint' }
		);
		store.set('envConstantContributions.provider', ['const PROVIDED 7']);
		expect(state.historyStack).toHaveLength(1);
		events.dispatch('undo');
		expect(authored().code).toEqual(['module authored', 'moduleEnd']);
		expect(env()).toBe(environment);
		expect(env()).toMatchObject({ gridX: 0, gridY: 0, readOnly: true });
		expect(env().code).toContain('; @pos 0 0');
		expect(env().code).toContain('const PROVIDED 7');
		events.dispatch('redo');
		expect(authored().code).toContain('push 1');
		expect(env()).toBe(environment);
		expect(env()).toMatchObject({ gridX: 0, gridY: 0, readOnly: true });
		expect(env().code).toContain('; @pos 0 0');
		expect(env().code).toContain('const PROVIDED 7');
	});
});
