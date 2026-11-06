import { EventEmitter } from 'node:events';
import type { CodeBlockGraphicData, CodeBlockLayoutsChangedEvent } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { expect, it } from 'vitest';
import initState from '~/index';

it('announces completed layouts after nested source and contribution updates during project loading', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const contribution = store.layout.createContribution();
	const completedLayouts: boolean[] = [];
	store.subscribe('codeErrors', () => {
		for (const block of state.codeBlockRendering.currentProject.blocks) {
			if (block.name === 'imported') {
				contribution.update(block, {
					verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }],
				});
			}
		}
	});
	events.on('codeBlockLayoutsChanged', ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		completedLayouts.push(
			codeBlocks.every(block =>
				block.displayModel.lines.every(line => line.isPlaceholder || line.text === block.code[line.sourceLineIndex])
			)
		);
	});
	try {
		events.dispatch('loadProject', {
			project: parseProjectSource(`8f4e/v1
constants env
${Array.from({ length: 20 }, (_, index) => `const SAVED_${index} ${index}`).join('\n')}
constantsEnd
note imported
; @config audioRuntime.enabled true
Imported project
noteEnd`),
		});
		expect(completedLayouts.length).toBeGreaterThan(0);
		expect(completedLayouts).not.toContain(false);
		const env = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'env')!;
		expect(env.code).not.toContain('const SAVED_0 0');
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'imported')!.gaps.size).toBe(1);
	} finally {
		contribution.dispose();
		store.dispose();
	}
});

it('notifies only affected blocks after dependent layout contributions settle', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('loadProject', {
		project: parseProjectSource(`8f4e/v1
note first
First block
noteEnd
note second
Second block
noteEnd`),
	});
	const state = store.getState();
	const first = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'first')!;
	const second = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'second')!;
	const contribution = store.layout.createContribution();
	const dependent = store.layout.createContribution();
	const notifications: Array<readonly CodeBlockGraphicData[]> = [];
	let updateDependent = false;
	const unsubscribe = store.layout.subscribe(({ codeBlock }) => {
		if (updateDependent && codeBlock === first) {
			dependent.update(second, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 3 }] });
		}
	});
	events.on('codeBlockLayoutsChanged', ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		notifications.push([...codeBlocks]);
	});
	try {
		contribution.update(first, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 1 }] });
		expect(notifications).toEqual([[first]]);
		notifications.length = 0;
		updateDependent = true;
		contribution.update(first, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(notifications).toEqual([[first, second]]);
		expect(first.height).toBe(5 * state.viewport.hGrid);
		expect(second.height).toBe(6 * state.viewport.hGrid);
	} finally {
		unsubscribe();
		dependent.dispose();
		contribution.dispose();
		store.dispose();
	}
});
