import { EventEmitter } from 'node:events';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { serializeProjectLevel } from '../../index';
import type { ResolveCodeBlockDragTargetsEvent } from '../code-blocks/features/codeBlockDragger/effect';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

const presets = `constants preset
; @pos 0 0
const VALUE 11
constantsEnd
constants preset
; @pos 80 0
const VALUE 22
constantsEnd
note instructions
; @pos 0 30
Move the rightmost preset to select it.
noteEnd
entry main
module reader
; @pos 200 0
use preset
int value VALUE
moduleEnd
entryEnd`;

function setup(source: string) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	const withEnv = source.replace('8f4e/v1\n', '8f4e/v1\nconstants env\n; @pos -100 -100\nconstantsEnd\n');
	events.dispatch('loadProject', { project: parseProjectSource(withEnv) });
	events.dispatch('enterEditMode');
	const state = store.getState();
	const onInputChanged = vi.fn();
	events.on('compilationInputChanged', onInputChanged);
	const beginDrag = (block: CodeBlockGraphicData) => {
		events.dispatch('mousedown', {
			x: block.x - state.viewport.x + 1,
			y: block.y - state.viewport.y + 1,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 800,
			canvasHeight: 600,
			altKey: false,
		});
	};
	const move = (x: number, y = 0) =>
		events.dispatch('mousemove', { movementX: x * state.viewport.vGrid, movementY: y * state.viewport.hGrid });
	const drop = () => events.dispatch('mouseup');
	const values = () =>
		serializeProjectLevel(state.codeBlockRendering.currentProject)
			.constants.filter(block => block.code[0] === 'constants preset')
			.map(block => block.code.find(line => line.startsWith('const VALUE ')));
	return { state, events, beginDrag, move, drop, values, onInputChanged };
}

describe('compilation after spatial order changes', () => {
	it.each([
		{ scope: 'root', nested: false, secondPosition: '80 0', movement: [100, 0] },
		{ scope: 'root', nested: false, secondPosition: '0 20', movement: [0, 40] },
		{ scope: 'nested', nested: true, secondPosition: '80 0', movement: [100, 0] },
		{ scope: 'nested', nested: true, secondPosition: '0 20', movement: [0, 40] },
	])('announces reordered $scope presets once on drop ($secondPosition)', ({ nested, secondPosition, movement }) => {
		const body = presets.replace('@pos 80 0', `@pos ${secondPosition}`);
		const source = nested ? `8f4e/v1\nentry main\ngroup voice\n${body}\ngroupEnd\nentryEnd` : `8f4e/v1\n${body}`;
		const test = setup(source);
		if (nested) {
			test.events.dispatch('openProjectGroup', {
				codeBlock: test.state.codeBlockRendering.rootProject.blocks.find(block => block.childProject),
			});
		}
		const first = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'preset')!;
		const initialRevision = test.state.compilerInputRevision;
		expect(test.values()).toEqual(['const VALUE 11', 'const VALUE 22']);
		test.beginDrag(first);
		test.drop();
		expect(test.onInputChanged).not.toHaveBeenCalled();
		test.beginDrag(first);
		test.move(movement[0], movement[1]);
		expect(test.onInputChanged).not.toHaveBeenCalled();
		test.drop();
		expect(test.values()).toEqual(['const VALUE 22', 'const VALUE 11']);
		expect(test.state.compilerInputRevision).toBe(initialRevision + 1);
		expect(test.onInputChanged).toHaveBeenCalledTimes(1);
		test.beginDrag(first);
		test.move(-movement[0], -movement[1]);
		test.drop();
		expect(test.values()).toEqual(['const VALUE 11', 'const VALUE 22']);
		expect(test.onInputChanged).toHaveBeenCalledTimes(2);
	});

	it('keeps repositioning and note-only order changes out of compilation', () => {
		const test = setup(`8f4e/v1\n${presets}`);
		const blocks = test.state.codeBlockRendering.currentProject.blocks;
		const first = blocks.find(block => block.name === 'preset')!;
		test.beginDrag(first);
		test.move(10);
		test.drop();
		expect(first.code).toContain('; @pos 10 0');
		const note = blocks.find(block => block.blockType === 'note')!;
		test.beginDrag(note);
		test.move(300);
		test.drop();
		expect(note.code).toContain('; @pos 300 30');
		expect(test.onInputChanged).not.toHaveBeenCalled();
	});

	it.each(['module', 'group'] as const)('announces changes to %s execution order', blockType => {
		const test = setup(`8f4e/v1
entry main
${blockType} first
; @pos 0 0
${blockType}End
${blockType} second
; @pos 80 0
${blockType}End
entryEnd`);
		const first = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'first')!;
		test.beginDrag(first);
		test.move(100);
		test.drop();
		expect(test.onInputChanged).toHaveBeenCalledTimes(1);
		expect(
			serializeProjectLevel(test.state.codeBlockRendering.currentProject).execution.map(block => block.code[0])
		).toEqual([`${blockType} second`, `${blockType} first`]);
	});

	it('announces a multi-block drag once after updating all positions', () => {
		const third = 'constants preset\n; @pos 160 0\nconst VALUE 33\nconstantsEnd\n';
		const test = setup(`8f4e/v1\n${presets.replace('entry main\n', `${third}entry main\n`)}`);
		const [first, second] = test.state.codeBlockRendering.currentProject.blocks.filter(
			block => block.name === 'preset'
		);
		test.events.on('resolveCodeBlockDragTargets', (request: ResolveCodeBlockDragTargetsEvent) => {
			request.targets = [first, second];
		});
		const orders: Array<Array<string | undefined>> = [];
		test.events.on('compilationInputChanged', () => orders.push(test.values()));
		test.beginDrag(first);
		test.move(300);
		test.drop();
		expect(first.code).toContain('; @pos 300 0');
		expect(second.code).toContain('; @pos 380 0');
		expect(test.onInputChanged).toHaveBeenCalledTimes(1);
		expect(orders).toEqual([['const VALUE 33', 'const VALUE 11', 'const VALUE 22']]);
	});
});
