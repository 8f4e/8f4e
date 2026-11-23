import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { getProjectGroups } from '@8f4e/language-spec';
import { afterEach, describe, expect, it } from 'vitest';
import initState, {
	applyCodeBlockSourceEdits,
	matchEditorDirectives,
	serializeProjectLevel,
	setGridSize,
} from '../../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

const source = '8f4e/v1\nentry main\nmodule audio\nint gate 0 ; @future first\nmoduleEnd\nentryEnd';

function setup(projectSource = source) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch('enterEditMode');
	cleanups.push(store.dispose);
	const load = (text: string) => events.dispatch('loadProject', { project: parseProjectSource(text) });
	load(projectSource);
	events.dispatch('enterEditMode');
	const state = store.getState();
	const audio = () => state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	return { store, state, events, load, audio };
}

function matched(block: CodeBlockGraphicData) {
	return matchEditorDirectives(block.parsedDirectives, [{ name: 'future' }]);
}

it('keeps the template header when renaming an expanded group and updating child paths', () => {
	const { store, state } = setup(
		'8f4e/v1\ntemplate voice\nentry main\nmodule audio\nint gate 0\nmoduleEnd\nentryEnd\ntemplateEnd\nentry main\ngroup left use voice\ngroupEnd\nentryEnd'
	);
	const group = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'left')!;
	applyCodeBlockSourceEdits(store, [{ codeBlock: group, code: ['group renamed use voice', ...group.code.slice(1)] }]);
	expect(group.name).toBe('renamed');
	expect(group.code[0]).toBe('group renamed use voice');
	expect(group.childProject?.blocks.find(block => block.name === 'audio')?.projectPath).toBe('renamed');
	expect(getProjectGroups(serializeProjectLevel(state.codeBlockRendering.rootProject))[0]).toMatchObject({
		name: 'renamed',
		code: ['group renamed use voice', 'groupEnd'],
	});
});

it('preserves edited group wrapper source and child scope in the serialized project', () => {
	const { store, events, state } = setup(
		'8f4e/v1\nentry main\ngroup parent\nentry main\ngroup voice\nentry main\nmodule oscillator\nint value 1\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd\ngroupEnd\nentryEnd'
	);
	const parent = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'parent')!;
	events.dispatch('openProjectGroup', { codeBlock: parent });
	const voice = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'voice')!;
	for (const code of [
		['group voice', '; keep this row', 'group ghost', 'groupEnd'],
		['', 'group voice use authored; comment', 'groupEnd', ''],
	]) {
		applyCodeBlockSourceEdits(store, [{ codeBlock: voice, code }]);
		const [serializedParent] = getProjectGroups(serializeProjectLevel(state.codeBlockRendering.rootProject));
		expect(getProjectGroups(serializedParent)[0]).toMatchObject({
			name: 'voice',
			id: voice.creationIndex,
			code,
			execution: [{ type: 'module', code: ['module oscillator', 'int value 1', 'moduleEnd'] }],
		});
		expect(voice.projectPath).toBe('parent');
		expect(voice.childProject?.blocks.find(block => block.name === 'oscillator')?.projectPath).toBe('parent/voice');
	}
});

describe('cached directive records', () => {
	it('shares prepared tab geometry across cursor and layout changes and refreshes it before source layouts', () => {
		const { store, events, audio } = setup('8f4e/v1\nentry main\nmodule audio\n; @tab 8\n\tvalue\nmoduleEnd\nentryEnd');
		const block = audio();
		store.set('codeBlockRendering.selectedCodeBlock', block);
		const tabStops = block.tabStopsByLine;
		expect(tabStops).toEqual([[], [8], [8], [8]]);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 2);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.col', 1);
		events.dispatch('gridSizeChanged');
		expect(block.tabStopsByLine).toBe(tabStops);
		const received: number[][][] = [];
		cleanups.push(
			store.layout.subscribe(({ codeBlock }) => {
				if (codeBlock === block) received.push(codeBlock.tabStopsByLine);
			})
		);
		applyCodeBlockSourceEdits(store, [
			{
				codeBlock: block,
				code: ['module audio', '; inserted', '; @tab 40', '\tvalue', 'moduleEnd'],
			},
		]);
		expect(received.at(-1)).toEqual([[], [], [40], [40], [40]]);
		expect(block.width).toBe(51 * store.getState().viewport.vGrid);
	});

	it('updates metadata and configuration before publishing layouts, including diagnostic row changes', () => {
		const { store, state, audio } = setup(
			'8f4e/v1\nnote audio\n; @config export.fileName initial\n; @config unknown value\nnoteEnd'
		);
		const block = audio();
		const seen: unknown[] = [];
		cleanups.push(
			store.layout.subscribe(({ codeBlock }) => {
				if (codeBlock !== block) return;
				seen.push([
					block.gridX,
					block.gridY,
					state.editorConfig.export?.fileName,
					state.codeErrors['editor-directives'][0]?.lineNumber,
				]);
			})
		);
		seen.length = 0;
		applyCodeBlockSourceEdits(store, [
			{
				codeBlock: block,
				code: ['note audio', '; @pos 20 30', '; @config export.fileName updated', '; @config unknown value', 'noteEnd'],
			},
		]);
		expect(seen.length).toBeGreaterThan(0);
		for (const value of seen) expect(value).toEqual([20, 30, 'updated', 3]);
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['note audio', '; @pos 20 30', 'noteEnd'] }]);
		expect(state.editorConfig.export?.fileName).toBeUndefined();
		expect(state.codeErrors['editor-directives']).toEqual([]);
	});

	it('delivers existing unknown records to late layout subscribers and reuses them during layout changes', () => {
		const { store, events, audio } = setup();
		const block = audio();
		const records = block.parsedDirectives;
		const received: string[][] = [];
		const unsubscribe = store.layout.subscribe(({ codeBlock }) => {
			if (codeBlock === block) received.push(matched(codeBlock).flatMap(directive => directive.args));
		});
		cleanups.push(unsubscribe);
		expect(received.at(-1)).toEqual(['first']);
		const contribution = store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		events.dispatch('gridSizeChanged');
		expect(block.parsedDirectives).toBe(records);
		expect(received.at(-1)).toEqual(['first']);
	});

	it('refreshes records before layout consumers run after source edits, undo, redo, and replacement', () => {
		const { store, events, audio, load } = setup();
		const seen: string[][] = [];
		cleanups.push(
			store.layout.subscribe(({ codeBlock }) => {
				if (codeBlock.name === 'audio') seen.push(matched(codeBlock).flatMap(directive => directive.args));
			})
		);
		const block = audio();
		store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor = { row: 1, col: block.code[1].length, y: 0 };
		applyCodeBlockSourceEdits(store, [
			{ codeBlock: block, code: block.code.map((line, row) => (row === 1 ? `${line} changed` : line)) },
		]);
		expect(seen.at(-1)).toEqual(['first', 'changed']);
		events.dispatch('undo');
		expect(matched(audio())[0].args).toEqual(['first']);
		expect(seen.at(-1)).toEqual(['first']);
		events.dispatch('redo');
		expect(seen.at(-1)).toEqual(['first', 'changed']);
		load(source.replace('@future first', '@future replacement'));
		expect(seen.at(-1)).toEqual(['replacement']);
	});

	it('refreshes programmatic edits in nested project groups', () => {
		const { store, state, events, audio } = setup(
			'8f4e/v1\nentry main\ngroup voices\nentry main\nmodule audio\nint gate 0 ; @future nested\nmoduleEnd\nentryEnd\ngroupEnd\nentryEnd'
		);
		const group = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'voices')!;
		events.dispatch('openProjectGroup', { codeBlock: group });
		const block = audio();
		expect(matched(block)[0].args).toEqual(['nested']);
		const seen: string[][] = [];
		cleanups.push(
			store.layout.subscribe(({ codeBlock }) => {
				if (codeBlock === block) seen.push(matched(codeBlock).flatMap(directive => directive.args));
			})
		);
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['module audio', '; @future edited', 'moduleEnd'] }]);
		expect(seen.at(-1)).toEqual(['edited']);
		events.dispatch('goToParentProjectGroup');
		events.dispatch('openProjectGroup', { codeBlock: group });
		expect(matched(audio())[0].args).toEqual(['edited']);
	});
});
