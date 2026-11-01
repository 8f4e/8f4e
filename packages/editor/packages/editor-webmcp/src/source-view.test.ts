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
		childProject: { path: '', blocks: [deep] },
	});
	const direct = module('oscillator', 'audio', 1);
	const audio = createMockCodeBlock({
		name: 'audio',
		projectPath: '',
		creationIndex: 0,
		entry: 'main',
		code: ['group audio', 'expose oscillator:value', 'groupEnd'],
		childProject: { path: '', blocks: [direct, voices] },
	});
	const root = module('rootModule', '', 4);
	const state = createMockState({ codeBlockRendering: { rootProject: { path: '', blocks: [audio, root] } } });
	return { state, audio, voices, root };
}

describe('one-level 8f4e source views', () => {
	it('renders root entries and group shells without exposing any descendants', () => {
		const { state } = fixture();
		const view = createSourceView(state);
		expect(view).toBe(
			'8f4e/v1\n\nentry main\n\ngroup audio\nexpose oscillator:value\ngroupEnd\n\nmodule rootModule\nint value 1\nmoduleEnd\nentryEnd'
		);
		expect(view).not.toContain('module oscillator');
		expect(view).not.toContain('group voices');
	});

	it('reads only the currently expanded group, including nested group shells', () => {
		const { state, audio, voices } = fixture();
		state.codeBlockRendering.currentProject = audio.childProject!;
		const view = createSourceView(state);
		expect(view).toBe(
			'group audio\nexpose oscillator:value\n\nmodule oscillator\nint value 1\nmoduleEnd\n\ngroup voices\n; voice settings\ngroupEnd\ngroupEnd'
		);
		expect(view).not.toContain('deepSecret');
		state.codeBlockRendering.currentProject = voices.childProject!;
		const nested = createSourceView(state);
		expect(nested).toContain('module deepSecret');
		expect(nested).not.toContain('module oscillator');
	});

	it('reads unfinished code without export validation and rejects an unavailable current scope', () => {
		const { state, root } = fixture();
		root.code = ['module unfinished', 'push'];
		expect(createSourceView(state)).toContain('module unfinished\npush');
		state.codeBlockRendering.currentProject = { path: 'missing', blocks: [] };
		expect(() => createSourceView(state)).toThrow('currently expanded group is unavailable');
	});

	it('preserves root-owned source, entry boundaries, blank lines, and empty group shells', () => {
		const { state, audio, root } = fixture();
		audio.childProject!.blocks = [];
		root.entry = 'secondary';
		const scope = createMockCodeBlock({
			isProjectScope: true,
			projectPath: '',
			code: ['pass shared', '', '; root comment'],
			creationIndex: 5,
		});
		state.codeBlockRendering.rootProject.blocks.push(scope);
		const view = createSourceView(state);
		expect(view).toContain('pass shared\n\n; root comment');
		expect(view).toContain('entry main\n');
		expect(view).toContain('entry secondary\n');
		state.codeBlockRendering.currentProject = audio.childProject!;
		expect(createSourceView(state)).toBe(audio.code.join('\n'));
	});
});
