import type { CodeBlockGraphicData, EditorProjectSnapshot } from '@8f4e/editor-core';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
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
		nestedProjectCodeBlocks: [deep],
	});
	const direct = module('oscillator', 'audio', 1);
	const audio = createMockCodeBlock({
		name: 'audio',
		projectPath: '',
		creationIndex: 0,
		entry: 'main',
		code: ['group audio', 'expose oscillator:value', 'groupEnd'],
		nestedProjectCodeBlocks: [direct, voices],
	});
	const root = module('rootModule', '', 4);
	const all = [audio, direct, voices, deep, root];
	const snapshot = {
		revision: 'test:1',
		projectPath: '',
		blocks: all.map(block => ({ blockId: `handle-${block.creationIndex}`, block })),
	} as EditorProjectSnapshot;
	return { snapshot, audio, voices, root };
}

function assertRanges(
	view: ReturnType<typeof createSourceView>,
	blocks: Array<{ blockId: string; block: CodeBlockGraphicData }>
) {
	for (const range of view.blocks) {
		const block = blocks.find(block => block.blockId === range.blockId)!.block;
		expect(
			view.code
				.split('\n')
				.slice(range.startLine - 1, range.endLine)
				.join('\n')
		).toBe(block.code.join('\n'));
	}
}

describe('one-level 8f4e source views', () => {
	it('renders root entries and group shells without exposing any descendants', () => {
		const { snapshot } = fixture();
		const view = createSourceView(snapshot);
		expect(view.code).toBe(
			'8f4e/v1\n\nentry main\n\ngroup audio\nexpose oscillator:value\ngroupEnd\n\nmodule rootModule\nint value 1\nmoduleEnd\nentryEnd'
		);
		expect(view.blocks.map(block => block.blockId)).toEqual(['handle-0', 'handle-4']);
		expect(view.code).not.toContain('module oscillator');
		expect(view.code).not.toContain('group voices');
		assertRanges(view, snapshot.blocks);
	});

	it('reads only the currently expanded group, including nested group shells', () => {
		const { snapshot } = fixture();
		snapshot.projectPath = 'audio';
		const view = createSourceView(snapshot);
		expect(view.projectPath).toBe('audio');
		expect(view.code).toBe(
			'group audio\nexpose oscillator:value\n\nmodule oscillator\nint value 1\nmoduleEnd\n\ngroup voices\n; voice settings\ngroupEnd\ngroupEnd'
		);
		expect(view.blocks.map(block => block.blockId)).toEqual(['handle-1', 'handle-2']);
		expect(view.code).not.toContain('deepSecret');
		assertRanges(view, snapshot.blocks);
		snapshot.projectPath = 'audio/voices';
		const nested = createSourceView(snapshot);
		expect(nested.projectPath).toBe('audio/voices');
		expect(nested.code).toContain('module deepSecret');
		expect(nested.code).not.toContain('module oscillator');
		assertRanges(nested, snapshot.blocks);
	});

	it('reads unfinished code without export validation and rejects an unavailable current scope', () => {
		const { snapshot, root } = fixture();
		root.code = ['module unfinished', 'push'];
		expect(createSourceView(snapshot).code).toContain('module unfinished\npush');
		snapshot.projectPath = 'missing';
		expect(() => createSourceView(snapshot)).toThrow('currently expanded group is unavailable');
	});

	it('preserves root-owned source, entry boundaries, blank lines, and empty group shells', () => {
		const { snapshot, audio, root } = fixture();
		audio.nestedProjectCodeBlocks = [];
		root.entry = 'secondary';
		const scope = createMockCodeBlock({
			isProjectScope: true,
			projectPath: '',
			code: ['pass shared', '', '; root comment'],
			creationIndex: 5,
		});
		snapshot.blocks.push({ blockId: 'scope', block: scope });
		const view = createSourceView(snapshot);
		expect(view.code).toContain('pass shared\n\n; root comment');
		expect(view.code).toContain('entry main\n');
		expect(view.code).toContain('entry secondary\n');
		snapshot.projectPath = 'audio';
		expect(createSourceView(snapshot).code).toBe(audio.code.join('\n'));
		assertRanges(view, snapshot.blocks);
	});
});
