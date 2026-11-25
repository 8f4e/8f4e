import { createProjectObjectModel, ErrorCode, type ProjectObjectModel } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject } from '../src';

const directProject: ProjectObjectModel = {
	...createProjectObjectModel(),
	entries: ['initDefaults'],
	execution: [
		{
			type: 'module',
			id: 1,
			entry: 'initDefaults',
			code: ['module voice', 'int value 7', 'moduleEnd'],
		},
	],
};

describe('reserved root entry exports', () => {
	it.each([
		['direct project model', directProject],
		['empty root entry', { ...directProject, execution: [] }],
	] as const)('rejects initDefaults in %s', async (_name, project) => {
		await expect(compileProject(project)).rejects.toMatchObject({
			message: expect.stringContaining('reserved'),
			diagnostic: {
				kind: 'source',
				domain: 'semantic',
				code: ErrorCode.RESERVED_ROOT_ENTRY_NAME,
				instruction: 'entry',
				symbol: 'initDefaults',
				location: { kind: 'project-entry', projectGroupPath: '', entryName: 'initDefaults' },
			},
		});
	});
});
