import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { applyCodeBlockSourceEdits, matchEditorDirectives } from '../../../../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

const source = '8f4e/v1\nentry main\nmodule audio\nint gate 0 ; @future first\nmoduleEnd\nentryEnd';

function setup(projectSource = source) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, initialEditorMode: 'edit' });
	cleanups.push(store.dispose);
	const load = (text: string) => events.dispatch('loadProject', { project: parseProjectSource(text) });
	load(projectSource);
	const state = store.getState();
	const audio = () => state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
	return { store, state, events, load, audio };
}

function matched(block: CodeBlockGraphicData) {
	return matchEditorDirectives(block.parsedDirectives, [{ name: 'future' }]);
}

describe('cached directive records', () => {
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
		events.dispatch('spriteSheetRerendered');
		expect(block.parsedDirectives).toBe(records);
		expect(received.at(-1)).toEqual(['first']);
	});

	it('refreshes records before layout consumers run after typing, undo, redo, and replacement', () => {
		const { store, events, audio, load } = setup();
		const seen: string[][] = [];
		cleanups.push(
			store.layout.subscribe(({ codeBlock }) => {
				if (codeBlock.name === 'audio') seen.push(matched(codeBlock).flatMap(directive => directive.args));
			})
		);
		const block = audio();
		store.set('codeBlockRendering.selectedCodeBlock', block);
		block.cursor = { row: 1, col: block.code[1].length, x: 0, y: 0 };
		events.dispatch('insertText', { text: ' changed' });
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
			'8f4e/v1\nentry main\ngroup voices\nmodule audio\nint gate 0 ; @future nested\nmoduleEnd\ngroupEnd\nentryEnd'
		);
		const group = state.codeBlockRendering.codeBlocks.find(block => block.name === 'voices')!;
		events.dispatch('openProjectGroup', { codeBlock: group });
		const block = audio();
		expect(matched(block)[0].args).toEqual(['nested']);
		const seen: string[][] = [];
		cleanups.push(
			store.layout.subscribe(({ codeBlock }) => {
				if (codeBlock === block) seen.push(matched(codeBlock).flatMap(directive => directive.args));
			})
		);
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['module audio', '; @future edited', 'moduleEnd'] }], {
			affectsCompilation: false,
		});
		expect(seen.at(-1)).toEqual(['edited']);
		events.dispatch('goToParentProjectGroup');
		events.dispatch('openProjectGroup', { codeBlock: group });
		expect(matched(audio())[0].args).toEqual(['edited']);
	});
});
