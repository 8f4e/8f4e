import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	createChildProjectGroupPath,
	createProjectModuleId,
	getProjectGroupPathFromModuleId,
	type ProjectBlock,
	type ProjectBlockId,
	type ProjectEntryName,
	type ProjectExecutableBlock,
	type ProjectGroupObjectModel,
	type ProjectMemoryAliasLookup,
	type ProjectMemoryExposure,
	type ProjectModuleBlock,
	type ProjectObjectModel,
	projectInstructionNames,
	projectInstructions,
	ROOT_PROJECT_GROUP_PATH,
	resolveProjectMemoryAlias,
} from './project';

describe('ProjectObjectModel', () => {
	it('encodes executable kinds in one ordered collection and keeps declarations hoisted', () => {
		expectTypeOf<ProjectBlock['id']>().toEqualTypeOf<ProjectBlockId>();
		expectTypeOf<ProjectModuleBlock['entry']>().toEqualTypeOf<ProjectEntryName>();
		expectTypeOf<ProjectObjectModel['execution']>().toEqualTypeOf<ProjectExecutableBlock[]>();
		expectTypeOf<ProjectModuleBlock['type']>().toEqualTypeOf<'module'>();
		expectTypeOf<ProjectGroupObjectModel['type']>().toEqualTypeOf<'group'>();
		expectTypeOf<ProjectGroupObjectModel['id']>().toEqualTypeOf<ProjectBlockId>();
		expectTypeOf<ProjectObjectModel['functions']>().toEqualTypeOf<ProjectBlock[]>();
		expectTypeOf<ProjectGroupObjectModel['entry']>().toEqualTypeOf<ProjectEntryName>();
		expectTypeOf<ProjectGroupObjectModel['code']>().toEqualTypeOf<string[]>();
		expectTypeOf<ProjectGroupObjectModel['exposures']>().toEqualTypeOf<ProjectMemoryExposure[]>();
	});

	it('creates canonical group paths and module ids', () => {
		const audioPath = createChildProjectGroupPath(ROOT_PROJECT_GROUP_PATH, 'audio');
		const voicesPath = createChildProjectGroupPath(audioPath, 'voices/lead');

		expect(audioPath).toBe('audio');
		expect(voicesPath).toBe('audio/voices%2Flead');
		expect(createProjectModuleId(ROOT_PROJECT_GROUP_PATH, 'counter')).toBe('counter');
		expect(createProjectModuleId(voicesPath, 'counter-left')).toBe('audio/voices%2Flead/counter-left');
		expect(getProjectGroupPathFromModuleId('counter')).toBe(ROOT_PROJECT_GROUP_PATH);
		expect(getProjectGroupPathFromModuleId('audio/voices/counter')).toBe('audio/voices');
	});

	it('defines project-level source instructions', () => {
		expect(projectInstructions).toEqual({
			entry: { opener: 'entry', closer: 'entryEnd' },
			group: { opener: 'group', closer: 'groupEnd' },
			expose: 'expose',
			init: 'init',
			pass: 'pass',
		});
		expect(projectInstructionNames).toEqual(['entry', 'entryEnd', 'group', 'groupEnd', 'expose', 'init', 'pass']);
	});

	it('resolves structured project memory aliases', () => {
		const aliases: ProjectMemoryAliasLookup = new Map([
			['audio', new Map([['level', { targetModuleId: 'audio/source', targetMemoryId: 'value' }]])],
		]);

		expect(resolveProjectMemoryAlias(aliases, 'audio', 'level')).toEqual({
			targetModuleId: 'audio/source',
			targetMemoryId: 'value',
		});
		expect(resolveProjectMemoryAlias(aliases, 'other', 'value')).toEqual({
			targetModuleId: 'other',
			targetMemoryId: 'value',
		});
	});
});
