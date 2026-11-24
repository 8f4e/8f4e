import type { ProjectLevel } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '../__tests__/helpers/mockEditorState';
import { findParentProjectLevel, updateProjectLevelPath } from './tree';

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
	it('finds immediate parents, including empty groups', () => {
		const { root, audio, child } = fixture();
		child.blocks.length = 0;
		expect(findParentProjectLevel(root, child)).toBe(audio);
		expect(findParentProjectLevel(root, audio)).toBe(root);
		expect(findParentProjectLevel(root, root)).toBeUndefined();
	});

	it('finds the parent by actual ownership even when sibling group paths are identical', () => {
		const { root, audio, child } = fixture();
		const second = fixture();
		root.blocks.push(second.root.blocks[0]);
		expect(second.child.path).toBe(child.path);
		expect(findParentProjectLevel(root, child)).toBe(audio);
		expect(findParentProjectLevel(root, second.child)).toBe(second.audio);
		expect(findParentProjectLevel(root, { ...second.child })).toBeUndefined();
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
