import type { CodeError, ProjectLevel } from '@8f4e/editor-state-types';
import { expect, it } from 'vitest';
import { createMockCodeBlock } from '../__tests__/helpers/mockEditorState';
import { createCodeErrorBlockLookup } from './getCodeBlockErrors';

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
	const project: ProjectLevel = { path: '', entries: [], blocks: [root, group] };
	const findBlock = createCodeErrorBlockLookup(project);
	const error = (fields: Partial<CodeError>): CodeError => ({
		codeBlockId: -1,
		lineNumber: 0,
		message: 'Fixture error',
		...fields,
	});
	return { root, voice, group, findBlock, error };
}

it('indexes document identities and group source scopes', () => {
	const { root, voice, group, findBlock, error } = fixture();
	expect(findBlock(error({ codeBlockId: root.creationIndex }))).toBe(root);
	expect(findBlock(error({ codeBlockId: voice.creationIndex }))).toBe(voice);
	expect(findBlock(error({ projectGroupPath: 'audio' }))).toBe(group);
	expect(findBlock(error({ projectGroupPath: '' }))).toBeUndefined();
	expect(findBlock(error({ codeBlockId: 999 }))).toBeUndefined();
	expect(findBlock(error({ projectGroupPath: 'missing' }))).toBeUndefined();
});

it('retains project-tree precedence when a diagnostic matches both a document and a scope', () => {
	const { root, voice, group, findBlock, error } = fixture();
	expect(findBlock(error({ codeBlockId: voice.creationIndex, projectGroupPath: 'audio' }))).toBe(group);
	expect(findBlock(error({ codeBlockId: voice.creationIndex, projectGroupPath: '' }))).toBe(voice);
	expect(findBlock(error({ codeBlockId: root.creationIndex, projectGroupPath: 'audio' }))).toBe(root);
});
