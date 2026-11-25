import type { CodeError, ProjectLevel } from '@8f4e/editor-state-types';
import { expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '../__tests__/helpers/mockEditorState';
import getCodeBlockErrors, { createCodeErrorBlockLookup } from './getCodeBlockErrors';

function fixture() {
	const root = createMockCodeBlock({
		creationIndex: 0,
		projectPath: '',
		name: 'root',
		code: ['module root', 'moduleEnd'],
	});
	const voice = createMockCodeBlock({
		creationIndex: 2,
		projectPath: 'audio',
		name: 'voice',
		code: ['module voice', 'push 1', 'moduleEnd'],
	});
	const group = createMockCodeBlock({
		creationIndex: 1,
		projectPath: '',
		name: 'audio',
		code: ['group audio', 'pass missing', 'groupEnd'],
		childLevel: { path: 'audio', entries: [], blocks: [voice] },
	});
	const copy = createMockCodeBlock({
		creationIndex: 3,
		name: 'audio',
		code: ['group audio', 'pass missing', 'groupEnd'],
		childLevel: { path: 'audio', entries: [], blocks: [] },
	});
	const project: ProjectLevel = { path: '', entries: [], blocks: [root, group, copy] };
	const findBlock = createCodeErrorBlockLookup(project);
	const error = (fields: Partial<CodeError>): CodeError => ({
		codeBlockId: -1,
		lineNumber: 0,
		message: 'Fixture error',
		...fields,
	});
	return { root, voice, group, copy, project, findBlock, error };
}

it('indexes root, nested and group block identities', () => {
	const { root, voice, group, findBlock, error } = fixture();
	expect(findBlock(error({ codeBlockId: root.creationIndex }))).toBe(root);
	expect(findBlock(error({ codeBlockId: voice.creationIndex }))).toBe(voice);
	expect(findBlock(error({ codeBlockId: group.creationIndex }))).toBe(group);
	expect(findBlock(error({ codeBlockId: undefined }))).toBeUndefined();
	expect(findBlock(error({ codeBlockId: 999 }))).toBeUndefined();
});

it('matches only the targeted group when two groups share a path', () => {
	const { group, copy, project, findBlock, error } = fixture();
	const diagnostic = error({ codeBlockId: copy.creationIndex });
	const state = createMockState({ project: { rootLevel: project }, codeErrors: { compiler: [diagnostic] } });
	expect(findBlock(diagnostic)).toBe(copy);
	expect(getCodeBlockErrors(state, group)).toEqual([]);
	expect(getCodeBlockErrors(state, copy)).toEqual([diagnostic]);
});
