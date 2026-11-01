import type { ProjectLevel } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { copyProjectLevel, findParentProjectLevel, findProjectLevel, updateProjectLevelPath } from './projectTree';
import { createMockCodeBlock } from './testingUtils/testUtils';

function fixture() {
	const child: ProjectLevel = { entries: [], path: 'Audio/Voices', blocks: [createMockCodeBlock({ name: 'voice' })] };
	const audio: ProjectLevel = {
		entries: [],
		path: 'Audio',
		blocks: [createMockCodeBlock({ name: 'Voices', childProject: child })],
	};
	const root: ProjectLevel = {
		entries: [],
		path: '',
		blocks: [createMockCodeBlock({ name: 'Audio', childProject: audio })],
	};
	return { root, audio, child };
}

describe('project tree', () => {
	it('finds explicit levels and their immediate parents, including empty groups', () => {
		const { root, audio, child } = fixture();
		child.blocks.length = 0;
		expect(findProjectLevel(root, '')).toBe(root);
		expect(findProjectLevel(root, 'Audio/Voices')).toBe(child);
		expect(findProjectLevel(root, 'missing')).toBeUndefined();
		expect(findParentProjectLevel(root, child)).toBe(audio);
		expect(findParentProjectLevel(root, audio)).toBe(root);
		expect(findParentProjectLevel(root, root)).toBeUndefined();
	});

	it('copies source-edit drafts without sharing source or remembering runtime views', () => {
		const { root, child } = fixture();
		child.viewport = { x: 64, y: 96 };
		child.entries = ['foo', 'bar'];
		const copy = copyProjectLevel(root);
		const copiedChild = findProjectLevel(copy, child.path)!;
		copiedChild.blocks[0].code.push('changed');
		copiedChild.entries.push('copyOnly');
		expect(child.entries).toEqual(['foo', 'bar']);
		expect(child.blocks[0].code).toEqual([]);
		expect(copiedChild.viewport).toBeUndefined();
	});

	it('updates nested paths after a group rename while retaining its remembered view', () => {
		const { audio, child } = fixture();
		child.viewport = { x: 64, y: 96 };
		updateProjectLevelPath(audio, 'Synth');
		expect(audio.path).toBe('Synth');
		expect(child.path).toBe('Synth/Voices');
		expect(child.blocks[0].projectPath).toBe('Synth/Voices');
		expect(child.viewport).toEqual({ x: 64, y: 96 });
	});
});
