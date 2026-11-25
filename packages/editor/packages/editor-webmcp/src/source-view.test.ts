import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { createSourceView } from './source-view';

function fixture() {
	const module = (name: string, projectPath: string, creationIndex: number) =>
		createMockCodeBlock({
			name,
			projectPath,
			creationIndex,
			entry: 'main',
			blockType: 'module',
			code: [`module ${name}`, 'int value 1', 'moduleEnd'],
		});
	const deep = module('deepSecret', 'audio/voices', 3);
	const voices = createMockCodeBlock({
		name: 'voices',
		projectPath: 'audio',
		creationIndex: 2,
		entry: 'main',
		code: ['group voices', '; voice settings', 'groupEnd'],
		childLevel: { path: 'audio/voices', entries: ['main'], blocks: [deep] },
	});
	const direct = module('oscillator', 'audio', 1);
	const audio = createMockCodeBlock({
		name: 'audio',
		projectPath: '',
		creationIndex: 0,
		entry: 'main',
		code: ['group audio', 'expose oscillator:value', 'groupEnd'],
		childLevel: { path: 'audio', entries: ['main'], blocks: [direct, voices] },
	});
	const root = module('rootModule', '', 4);
	const state = createMockState({
		project: { rootLevel: { entries: [], path: '', blocks: [audio, root] } },
	});
	return { state, audio, voices, root };
}

describe('one-level 8f4e source views', () => {
	it('renders root entries and group shells without exposing any descendants', () => {
		const { state } = fixture();
		const view = createSourceView(state);
		expect(view).toBe(
			'8f4e/v1\n\nentry main\n\ngroup audio\nexpose oscillator:value\nentry main\nentryEnd\ngroupEnd\n\nmodule rootModule\nint value 1\nmoduleEnd\nentryEnd'
		);
		expect(view).not.toContain('module oscillator');
		expect(view).not.toContain('group voices');
	});

	it('reads only the currently expanded group, including nested group shells', () => {
		const { state, audio, voices } = fixture();
		state.project.activeLevel = audio.childLevel!;
		const view = createSourceView(state);
		expect(view).toBe(
			'group audio\nexpose oscillator:value\n\nentry main\n\nmodule oscillator\nint value 1\nmoduleEnd\n\ngroup voices\n; voice settings\nentry main\nentryEnd\ngroupEnd\nentryEnd\ngroupEnd'
		);
		expect(view).not.toContain('deepSecret');
		state.project.activeLevel = voices.childLevel!;
		const nested = createSourceView(state);
		expect(nested).toContain('module deepSecret');
		expect(nested).not.toContain('module oscillator');
	});

	it('reads the expanded nested group from its actual owner when sibling group paths match', () => {
		const { state } = fixture();
		const copy = fixture();
		copy.audio.creationIndex = 5;
		copy.audio.childLevel!.blocks[0].creationIndex = 6;
		copy.voices.creationIndex = 7;
		copy.voices.childLevel!.blocks[0].creationIndex = 8;
		copy.voices.code = ['group voices', '; copied voice settings', 'groupEnd'];
		state.project.rootLevel.blocks.push(copy.audio);
		state.project.activeLevel = copy.voices.childLevel!;
		const view = createSourceView(state);
		expect(view).toContain('; copied voice settings');
		expect(view).toContain('module deepSecret');
		expect(view).not.toContain('; voice settings');
	});

	it('retains empty named entries and unfinished group shells', () => {
		const { state, audio } = fixture();
		audio.code = ['group audio', '; unfinished settings'];
		audio.childLevel!.blocks = [];
		audio.childLevel!.entries = ['foo', 'bar'];
		expect(createSourceView(state)).toContain(
			'group audio\n; unfinished settings\nentry foo\nentryEnd\nentry bar\nentryEnd'
		);
		state.project.activeLevel = audio.childLevel!;
		const view = createSourceView(state);
		expect(view).toContain('entry foo\nentryEnd');
		expect(view).toContain('entry bar\nentryEnd');
		expect(view).not.toContain('entry main');
	});

	it('reads unfinished code without export validation and rejects an unavailable current scope', () => {
		const { state, root } = fixture();
		root.code = ['module unfinished', 'push'];
		expect(createSourceView(state)).toContain('module unfinished\npush');
		state.project.activeLevel = { entries: [], path: 'missing', blocks: [] };
		expect(() => createSourceView(state)).toThrow('currently expanded group is unavailable');
	});

	it('preserves unfinished block source, entry boundaries, blank lines, and empty group shells', () => {
		const { state, audio, root } = fixture();
		audio.childLevel!.blocks = [];
		root.entry = 'secondary';
		const draft = createMockCodeBlock({
			blockType: 'unknown',
			projectPath: '',
			code: ['int value', '', '; draft comment'],
			creationIndex: 5,
		});
		state.project.rootLevel.blocks.push(draft);
		const view = createSourceView(state);
		expect(view).toContain('int value\n\n; draft comment');
		expect(view).toContain('entry main\n');
		expect(view).toContain('entry secondary\n');
		state.project.activeLevel = audio.childLevel!;
		expect(createSourceView(state)).toBe('group audio\nexpose oscillator:value\n\nentry main\nentryEnd\ngroupEnd');
	});
});
