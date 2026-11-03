import type { ProjectIncludeResolver } from '@8f4e/language-spec';
import { getProjectGroups } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { parseProjectSource, resolveProjectIncludesAsync } from '../src';

describe('project-preparser integration', () => {
	it('preserves root and nested project-scope namespace passes', () => {
		const project = parseProjectSource(
			[
				'8f4e/v1',
				'',
				'; root contract',
				'pass env',
				'',
				'entry main',
				'group audio',
				'; child contract',
				'pass env',
				'groupEnd',
				'entryEnd',
			].join('\n')
		);

		expect(project.code).toEqual(['; root contract', 'pass env']);
		expect(getProjectGroups(project)[0].code).toEqual(['group audio', '; child contract', 'pass env', 'groupEnd']);
	});

	it('requires constants to be declared in a named constants block', () => {
		expect(() => parseProjectSource('8f4e/v1\nconst SAMPLE_RATE 48000')).toThrow(
			'Parse error at line 2: expected opener keyword, got "const SAMPLE_RATE 48000"'
		);
	});

	it('parses project source into typed collections and resolves its include collection', async () => {
		const source = [
			'8f4e/v1',
			'',
			'includes',
			'include std/events/risingEdge',
			'include std/memory/wrapPointer',
			'includesEnd',
			'',
			'constants shared',
			'const TABLE_SIZE 16',
			'constantsEnd',
			'',
			'function helper',
			'functionEnd int',
			'',
			'prototype state',
			'float phase',
			'int[] buffer 8',
			'prototypeEnd',
			'',
			'note',
			'; @pos 2 3',
			'Document-only project note.',
			'noteEnd',
			'',
			'entry main',
			'module main',
			'shape state',
			'int counter',
			'moduleEnd',
			'group audio',
			'entry main',
			'module grouped',
			'int ignoredByCompilerInput',
			'moduleEnd',
			'entryEnd',
			'function groupedHelper',
			'functionEnd int',
			'groupEnd',
			'entryEnd',
		].join('\n');
		const resolveInclude: ProjectIncludeResolver = includeId =>
			({
				'std/events/risingEdge': ['function risingEdge', '#export', 'functionEnd int'].join('\n'),
				'std/memory/wrapPointer': [
					'function wrapPointer',
					'#export',
					'functionEnd int*',
					'',
					'function wrapPointer',
					'#export',
					'functionEnd float*',
				].join('\n'),
			})[includeId];

		const project = parseProjectSource(source);
		expect({
			project,
			includedFunctions: await resolveProjectIncludesAsync(project.includes, resolveInclude),
		}).toMatchSnapshot();
	});
});
