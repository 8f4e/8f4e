import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { serializeToProject, setGridSize } from '~/index';

const disposers: Array<() => void> = [];
afterEach(() => {
	while (disposers.length) disposers.pop()!();
});

function setup(source: string, { grid = false } = {}) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, {
		callbacks: {},
		editorConfigSchemaContributions: { test: { root: 'test', schema: { type: 'integer' } } },
	});
	const state = store.getState();
	disposers.push(store.dispose);
	if (grid) setGridSize(state, events, { vGrid: 6, hGrid: 12 });
	const load = () => events.dispatch('loadProject', { project: parseProjectSource(source) });
	const block = (name: string) =>
		state.codeBlockRendering.rootProject.blocks.find(candidate => candidate.name === name)!;
	const projectChanged = vi.fn(() => serializeToProject(state));
	const compilerChanged = vi.fn(() => serializeToProject(state));
	store.subscribe('projectChange', projectChanged);
	events.on('compilationInputChanged', compilerChanged);
	return { store, state, events, load, block, projectChanged, compilerChanged };
}

describe('project source transactions', () => {
	it('settles synchronous generated source with an authored config edit before publishing either revision, without a grid', () => {
		const test = setup(`8f4e/v1
note settings
; @config test 10
noteEnd`);
		const { store, state, events, block, projectChanged, compilerChanged } = test;
		// A runtime config subscriber contributes source synchronously, just like the audio/worker plugins.
		store.subscribe('editorConfig.test', () => {
			store.set('envConstantContributions.test', [`const TEST ${state.editorConfig.test}`]);
		});
		test.load();
		expect(compilerChanged).toHaveBeenCalledOnce();
		expect(projectChanged).toHaveBeenCalledOnce();
		expect(block('env').code).toContain('const TEST 10');
		compilerChanged.mockClear();
		projectChanged.mockClear();
		const settings = block('settings');
		const environment = block('env');
		const previousProjectRevision = state.projectChange.revision;
		const previousCompilerRevision = state.compilerInputRevision;
		const result = store.projectEdits.apply({
			updates: [{ codeBlock: settings, code: ['note settings', '; @config test 20', 'noteEnd'] }],
		});
		expect(result.changed).toBe(true);
		expect(block('settings')).toBe(settings);
		expect(block('env')).toBe(environment);
		expect(state.gridSizeReady).toBe(false);
		expect(settings.width).toBe(0);
		expect(environment.code).toContain('const TEST 20');
		expect(state.editorConfig.test).toBe(20);
		expect(state.projectChange.revision).toBe(previousProjectRevision + 1);
		expect(state.compilerInputRevision).toBe(previousCompilerRevision + 1);
		expect(compilerChanged).toHaveBeenCalledOnce();
		expect(projectChanged).toHaveBeenCalledOnce();
		expect(compilerChanged.mock.results[0].value).toEqual(serializeToProject(state));
		expect(projectChanged.mock.results[0].value).toEqual(serializeToProject(state));
		setGridSize(state, events, { vGrid: 6, hGrid: 12 });
		expect(settings.width).toBeGreaterThan(0);
		expect(compilerChanged).toHaveBeenCalledOnce();
		expect(projectChanged).toHaveBeenCalledOnce();
	});

	it('does not publish an attempted read-only edit or an update with an identical final intent', () => {
		const test = setup('8f4e/v1\nnote sample\n; @custom\nnoteEnd', { grid: true });
		const { store, state, block, projectChanged, compilerChanged } = test;
		const apply = vi.fn();
		disposers.push(store.directives.register({ name: 'custom', apply }));
		test.load();
		const sample = block('sample');
		const env = block('env');
		const previousCode = sample.code;
		const previousEnv = env.code;
		const previousTimestamp = sample.lastUpdated;
		const previousEnvTimestamp = env.lastUpdated;
		const initialRevision = state.projectChange.revision;
		const initialCompilerRevision = state.compilerInputRevision;
		apply.mockClear();
		compilerChanged.mockClear();
		projectChanged.mockClear();
		expect(
			store.projectEdits.apply({
				updates: [{ codeBlock: env, code: ['constants env', 'const USER 123', 'constantsEnd'] }],
			}).changed
		).toBe(false);
		expect(
			store.projectEdits.apply({
				updates: [
					{ codeBlock: sample, code: ['note sample', '; @custom', 'changed', 'noteEnd'] },
					{ codeBlock: sample, code: [...previousCode] },
				],
			}).changed
		).toBe(false);
		expect(sample.code).toBe(previousCode);
		expect(env.code).toBe(previousEnv);
		expect(sample.lastUpdated).toBe(previousTimestamp);
		expect(env.lastUpdated).toBe(previousEnvTimestamp);
		expect(apply).not.toHaveBeenCalled();
		expect(compilerChanged).not.toHaveBeenCalled();
		expect(projectChanged).not.toHaveBeenCalled();
		expect(state.projectChange.revision).toBe(initialRevision);
		expect(state.compilerInputRevision).toBe(initialCompilerRevision);
	});

	it('applies insertion, deletion and malformed source changes as one operation, retaining live block identity', () => {
		const test = setup('8f4e/v1\nnote keep\nold\nnoteEnd\nnote remove\nnoteEnd', { grid: true });
		const { store, state, block, projectChanged, compilerChanged } = test;
		test.load();
		const keep = block('keep');
		const remove = block('remove');
		const root = state.codeBlockRendering.rootProject;
		const blocks = root.blocks;
		store.set('codeBlockRendering.selectedCodeBlock', keep);
		projectChanged.mockClear();
		compilerChanged.mockClear();
		const incompleteSource = ['module invalid', 'unrecognizedInstruction 1'];
		const result = store.projectEdits.apply({
			updates: [{ codeBlock: keep, code: incompleteSource }],
			inserts: [{ project: root, source: { code: ['note inserted', '; @pos 8 9', 'noteEnd'] } }],
			deletes: [remove],
		});
		expect(result.changed).toBe(true);
		expect(root.blocks).toBe(blocks);
		expect(blocks).toContain(keep);
		expect(blocks).not.toContain(remove);
		expect(keep.code).toEqual(incompleteSource);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(keep);
		expect(result.insertedBlocks).toHaveLength(1);
		expect(result.insertedBlocks[0]).toMatchObject({ name: 'inserted', gridX: 8, gridY: 9, x: 48, y: 108 });
		expect(blocks).toContain(result.insertedBlocks[0]);
		expect(projectChanged).toHaveBeenCalledOnce();
		expect(compilerChanged).toHaveBeenCalledOnce();
	});

	it('retains ownership of unchanged descendants when editing multiple project levels', () => {
		const test = setup(
			'8f4e/v1\nnote remove\nnoteEnd\nentry main\ngroup child\nnote keep\nnoteEnd\ngroupEnd\nentryEnd'
		);
		const { store, state, block } = test;
		test.load();
		const root = state.codeBlockRendering.rootProject;
		const group = block('child');
		const child = group.childProject!;
		const existing = child.blocks[0];
		const {
			insertedBlocks: [rootInsert, childInsert],
		} = store.projectEdits.apply({
			deletes: [block('remove')],
			inserts: [
				{ project: root, source: { code: ['note rootAdded', 'noteEnd'] } },
				{ project: child, source: { code: ['note childAdded', 'noteEnd'] } },
			],
		});
		expect(root.blocks).toContain(rootInsert);
		expect(child.blocks).toEqual([existing, childInsert]);
		expect(
			store.projectEdits.apply({
				updates: [
					{ codeBlock: existing, code: ['note existing', 'noteEnd'] },
					{ codeBlock: childInsert, code: ['note childUpdated', 'noteEnd'] },
				],
			}).changed
		).toBe(true);
		expect(existing.name).toBe('existing');
		expect(childInsert.name).toBe('childUpdated');
		store.projectEdits.apply({ deletes: [group] });
		expect(() =>
			store.projectEdits.apply({ updates: [{ codeBlock: existing, code: ['note detached', 'noteEnd'] }] })
		).toThrow();
	});

	it('ignores entry assignments for non-execution blocks and retains the previous entry during incomplete edits', () => {
		const test = setup('8f4e/v1\nnote sample\nnoteEnd\nentry alternate\nmodule target\nmoduleEnd\nentryEnd');
		const { store, state, events, block, projectChanged, compilerChanged } = test;
		test.load();
		const sample = block('sample');
		const target = block('target');
		const before = serializeToProject(state);
		const beforeCheckpoint = vi.fn();
		events.on('beforeProjectEdit', beforeCheckpoint);
		projectChanged.mockClear();
		compilerChanged.mockClear();

		expect(
			store.projectEdits.apply({ updates: [{ codeBlock: sample, entry: 'unused' }] }, { history: 'checkpoint' }).changed
		).toBe(false);
		expect(sample.entry).toBeUndefined();
		expect(serializeToProject(state)).toEqual(before);
		expect(beforeCheckpoint).not.toHaveBeenCalled();
		expect(projectChanged).not.toHaveBeenCalled();
		expect(compilerChanged).not.toHaveBeenCalled();

		store.projectEdits.apply({ updates: [{ codeBlock: target, code: ['module target'], entry: 'unused' }] });
		expect(target.blockType).toBe('unknown');
		expect(target.entry).toBe('alternate');
		store.projectEdits.apply({ updates: [{ codeBlock: target, code: ['module target', 'moduleEnd'] }] });
		expect(target.entry).toBe('alternate');
		expect(state.codeBlockRendering.rootProject.entries).toEqual(['alternate']);
	});

	it('treats generated environment source as downstream of global configuration', () => {
		const test = setup('8f4e/v1\nnote settings\n; @config test 10\nnoteEnd');
		const { store, state, block, projectChanged, compilerChanged } = test;
		test.load();
		projectChanged.mockClear();
		compilerChanged.mockClear();
		store.set('envConstantContributions.test', ['; @config test 99', 'const TEST 99']);
		expect(block('env').code).toContain('const TEST 99');
		expect(state.editorConfig.test).toBe(10);
		expect(projectChanged).toHaveBeenCalledOnce();
		expect(compilerChanged).toHaveBeenCalledOnce();
	});
});
