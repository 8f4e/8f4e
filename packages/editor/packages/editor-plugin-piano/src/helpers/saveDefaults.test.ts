import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import type { PianoKeyboard } from '../types';
import { getPianoDefaultEdits } from './saveDefaults';

function createProjectState(blocks: CodeBlockGraphicData[], read: State['callbacks']['getWordFromMemory']): State {
	const state = createMockState();
	state.codeBlockRendering.rootCodeBlocks = blocks;
	state.codeBlockRendering.codeBlocks = blocks;
	state.callbacks.getWordFromMemory = read;
	return state;
}

function createRawMemoryReader(values: Record<number, { type: 'int32' | 'float32' | 'float64'; value: number }>) {
	const buffer = new ArrayBuffer(64);
	const int32 = new Int32Array(buffer);
	const float32 = new Float32Array(buffer);
	const float64 = new Float64Array(buffer);

	for (const [address, entry] of Object.entries(values)) {
		const wordAddress = Number.parseInt(address, 10);
		if (entry.type === 'int32') {
			int32[wordAddress] = entry.value;
		} else if (entry.type === 'float32') {
			float32[wordAddress] = entry.value;
		} else {
			float64[wordAddress / 2] = entry.value;
		}
	}

	return (allocationUnitAddress: number) => int32[allocationUnitAddress] ?? 0;
}

function createPianoCodeBlock(
	code = ['module synth', 'int[] notes 4 48', 'int count 1', '; @piano &notes &count 48', 'moduleEnd']
) {
	const codeBlock = createMockCodeBlock({ name: 'synth', blockType: 'module', code });
	const keyboards = [
		{
			pressedKeysListModuleId: 'synth',
			pressedNumberOfKeysModuleId: 'synth',
			pressedKeysListMemory: {
				id: 'notes',
				allocationUnitAddress: 4,
				numberOfElements: 4,
				elementWordSize: 4,
				isInteger: true,
			},
			pressedNumberOfKeysMemory: { id: 'count', allocationUnitAddress: 8, isInteger: true },
		} as PianoKeyboard,
	];
	return { codeBlock, keyboards };
}

describe('save piano default values to code', () => {
	it('preserves two unchanged notes using byte-sized compiler metadata', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock([
			'module synth',
			'int[] notes 2 2 3',
			'int count 2',
			'; @piano &notes &count',
			'moduleEnd',
		]);
		keyboards[0].pressedKeysListMemory.numberOfElements = 2;
		keyboards[0].pressedNumberOfKeysMemory.allocationUnitAddress = 6;
		const memory = new Map([
			[4, 2],
			[5, 3],
			[6, 2],
			[8, 19],
		]);

		const state = createProjectState([codeBlock], address => memory.get(address) ?? 0);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([]);
		expect(codeBlock.code[1]).toBe('int[] notes 2 2 3');
	});

	it('saves the active runtime notes and count while preserving array size expressions and comments', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock([
			'module synth',
			'  int[] notes CAPACITY 48 49 ; chord',
			'int count 2 ; active notes',
			'; @piano &notes &count 48',
			'int unrelated 42',
			'moduleEnd',
		]);
		const original = [...codeBlock.code];
		const state = createProjectState(
			[codeBlock],
			createRawMemoryReader({
				4: { type: 'int32', value: 36 },
				5: { type: 'int32', value: 52 },
				6: { type: 'int32', value: 84 },
				7: { type: 'int32', value: 99 },
				8: { type: 'int32', value: 3 },
			})
		);

		expect(getPianoDefaultEdits(state, keyboards)).toEqual([
			{
				codeBlock,
				code: [
					'module synth',
					'  int[] notes CAPACITY 36 52 84 ; chord',
					'int count 3 ; active notes',
					'; @piano &notes &count 48',
					'int unrelated 42',
					'moduleEnd',
				],
			},
		]);
		expect(codeBlock.code).toEqual(original);
	});

	it('clears array defaults when no notes are pressed', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock();
		const state = createProjectState([codeBlock], () => 0);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([
			{ codeBlock, code: ['module synth', 'int[] notes 4', 'int count 0', '; @piano &notes &count 48', 'moduleEnd'] },
		]);
	});

	it('decodes float32 notes and keeps floating-point literal syntax', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock([
			'module synth',
			'float[] notes 4 48.0',
			'int count 1',
			'; @piano &notes &count 48',
			'moduleEnd',
		]);
		keyboards[0].pressedKeysListMemory.isInteger = false;
		const state = createProjectState(
			[codeBlock],
			createRawMemoryReader({
				4: { type: 'float32', value: 50 },
				5: { type: 'float32', value: 52 },
				8: { type: 'int32', value: 2 },
			})
		);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([
			{
				codeBlock,
				code: ['module synth', 'float[] notes 4 50.0 52.0', 'int count 2', '; @piano &notes &count 48', 'moduleEnd'],
			},
		]);
	});

	it('bounds the count to the array capacity before reading notes', () => {
		const reader = createRawMemoryReader({
			4: { type: 'int32', value: 48 },
			5: { type: 'int32', value: 50 },
			6: { type: 'int32', value: 52 },
			7: { type: 'int32', value: 54 },
			8: { type: 'int32', value: 100 },
		});
		const { codeBlock, keyboards } = createPianoCodeBlock();
		const state = createProjectState([codeBlock], reader);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([
			{
				codeBlock,
				code: ['module synth', 'int[] notes 4 48 50 52 54', 'int count 4', '; @piano &notes &count 48', 'moduleEnd'],
			},
		]);
	});

	it('does nothing when defaults already match runtime memory', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock();
		const state = createProjectState(
			[codeBlock],
			createRawMemoryReader({
				4: { type: 'int32', value: 48 },
				8: { type: 'int32', value: 1 },
			})
		);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([]);
	});

	it('skips both defaults when a matching declaration is missing', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock([
			'module synth',
			'int[] other 4',
			'int count 1',
			'; @piano &notes &count 48',
			'moduleEnd',
		]);
		const state = createProjectState([codeBlock], () => 0);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([]);
	});

	it('edits the canonical owner when local declarations have the same names', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock([
			'module synth',
			'int[] notes 4 48',
			'int count 1',
			'; @piano &other:notes &other:count 48',
			'moduleEnd',
		]);
		keyboards[0].pressedKeysListModuleId = 'other';
		keyboards[0].pressedNumberOfKeysModuleId = 'other';
		const owner = createMockCodeBlock({
			blockType: 'module',
			code: ['module other', 'int[] notes 4 60', 'int count 1', 'moduleEnd'],
		});
		const originalSource = [...codeBlock.code];
		const originalOwner = [...owner.code];
		const state = createProjectState([codeBlock, owner], () => 0);
		const edits = getPianoDefaultEdits(state, keyboards);
		expect(edits).toEqual([{ codeBlock: owner, code: ['module other', 'int[] notes 4', 'int count 0', 'moduleEnd'] }]);
		expect(edits[0].codeBlock).toBe(owner);
		expect(codeBlock.code).toEqual(originalSource);
		expect(owner.code).toEqual(originalOwner);
	});

	it('allows references explicitly qualified with the current module', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock([
			'module synth',
			'int[] notes 4 48',
			'int count 1',
			'; @piano &synth:notes &synth:count 48',
			'moduleEnd',
		]);
		const state = createProjectState([codeBlock], () => 0);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([
			{
				codeBlock,
				code: ['module synth', 'int[] notes 4', 'int count 0', '; @piano &synth:notes &synth:count 48', 'moduleEnd'],
			},
		]);
	});

	it('skips invalid floating-point runtime values without saving a partial count', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock();
		keyboards[0].pressedKeysListMemory.isInteger = false;
		const state = createProjectState(
			[codeBlock],
			createRawMemoryReader({
				4: { type: 'float32', value: Number.NaN },
				8: { type: 'int32', value: 1 },
			})
		);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([]);
	});

	it('skips saving when runtime memory cannot be read', () => {
		const { codeBlock, keyboards } = createPianoCodeBlock();
		const state = createProjectState([codeBlock], undefined);
		expect(getPianoDefaultEdits(state, keyboards)).toEqual([]);
	});
});
