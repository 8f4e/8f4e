import type { CodeError, ProjectLevel } from '@8f4e/editor-state-types';
import { expect, it } from 'vitest';
import { createCodeErrorBlockLookup } from './getCodeBlockErrors';
import { createMockCodeBlock } from './testingUtils/testUtils';

function fixture() {
	const scope = createMockCodeBlock({
		creationIndex: 0,
		projectPath: '',
		isProjectScope: true,
		code: ['pass missing'],
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
		childProject: { path: 'audio', entries: [], blocks: [voice] },
	});
	const project: ProjectLevel = { path: '', entries: [], blocks: [scope, group] };
	const findBlock = createCodeErrorBlockLookup(project);
	const error = (fields: Partial<CodeError>): CodeError => ({
		codeBlockId: -1,
		lineNumber: 0,
		message: 'Fixture error',
		...fields,
	});
	return { scope, voice, group, findBlock, error };
}

it('indexes nested document identities and root/group source scopes', () => {
	const { scope, voice, group, findBlock, error } = fixture();
	expect(findBlock(error({ codeBlockId: voice.creationIndex }))).toBe(voice);
	expect(findBlock(error({ projectGroupPath: 'audio' }))).toBe(group);
	expect(findBlock(error({ projectGroupPath: '' }))).toBe(scope);
	expect(findBlock(error({ codeBlockId: 999 }))).toBeUndefined();
	expect(findBlock(error({ projectGroupPath: 'missing' }))).toBeUndefined();
});

it('retains project-tree precedence when a diagnostic matches both a document and a scope', () => {
	const { scope, voice, group, findBlock, error } = fixture();
	expect(findBlock(error({ codeBlockId: voice.creationIndex, projectGroupPath: 'audio' }))).toBe(group);
	expect(findBlock(error({ codeBlockId: voice.creationIndex, projectGroupPath: '' }))).toBe(scope);
	expect(findBlock(error({ codeBlockId: scope.creationIndex, projectGroupPath: 'audio' }))).toBe(scope);
});
