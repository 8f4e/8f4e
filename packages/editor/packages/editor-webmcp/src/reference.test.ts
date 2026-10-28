import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDocs, getExample, getHelp, searchDocs, searchExamples } from './reference';

const examplesRoot = dirname(createRequire(import.meta.url).resolve('@8f4e/examples/package.json'));

describe('bundled documentation and examples', () => {
	it('ships the introduction and live-editing workflow with the bridge', () => {
		expect(getHelp()).toBe(readFileSync(new URL('../help.md', import.meta.url), 'utf8'));
		for (const concept of ['stack', 'entry main', '; @pos', '#impure', 'search_docs', 'get_example', 'revision'])
			expect(getHelp()).toContain(concept);
	});

	it('finds instruction and directive sections and preserves their enclosing rules', async () => {
		const push = searchDocs('push').results[0];
		expect(push.topic).toBe('compiler/instructions/stack#push');
		expect(await getDocs(push.topic)).toContain('#### Local reads');
		expect(await getDocs(push.topic)).not.toContain('### drop');
		expect(await getDocs('compiler/instructions/stack')).toBe(
			readFileSync(new URL('../../../../compiler/docs/instructions/stack.md', import.meta.url), 'utf8')
		);
		const skip = searchDocs('#skipExecution').results.find(result => result.title === 'skipExecution')!;
		const directive = await getDocs(skip.topic);
		expect(directive).toContain('Compiler directives are block prologue metadata');
		expect(directive).toContain('## Module-Scoped Directives');
		expect(directive).toContain('#skipExecution');
		expect(directive).not.toContain('### `#impure`');
		const pos = searchDocs('@pos').results.find(result => result.topic === 'editor/editor-directives#pos')!;
		expect(await getDocs(pos.topic)).toContain('; @pos');
		expect(searchDocs('pointer').total).toBeGreaterThan(0);
	});

	it('paginates the documentation catalog without gaps and reports no matches', () => {
		const topics: string[] = [];
		let offset: number | null = 0;
		while (offset !== null) {
			const result = searchDocs('', offset);
			expect(result.results.length).toBeLessThanOrEqual(20);
			topics.push(...result.results.map(entry => entry.topic));
			offset = result.nextOffset;
		}
		expect(topics).toHaveLength(searchDocs('').total);
		expect(new Set(topics).size).toBe(topics.length);
		expect(topics).toContain('compiler/source-syntax');
		expect(topics).toContain('editor/editor-directives');
		expect(searchDocs('noSuchDocumentation9823')).toEqual({ results: [], total: 0, nextOffset: null });
	});

	it('returns reusable public blocks, their dependency paths, and exact complete project source', async () => {
		const filter = searchExamples('low pass filter', 'block').results[0];
		expect(filter).toMatchObject({ kind: 'block', path: 'filters/lowPassFilter', title: 'Low Pass Filter' });
		const code = await getExample(filter.kind, filter.path);
		expect(code).toMatch(/^module lowPassFilter\n/);
		expect(code).toContain('float alpha');
		expect(code).not.toMatch(/@public|8f4e\/v1|entryEnd/);
		expect(await getExample('block', 'functions/math/sine')).toMatch(/^function sine\n/);
		expect(await getExample('block', 'constants/math')).toMatch(/^constants math\n/);
		const phase = searchExamples('phase accumulator', 'block').results[0];
		expect(phase.dependencies).toContain('constants/math');
		for (const dependency of phase.dependencies) expect(await getExample('block', dependency)).not.toBe('');
		const project = searchExamples('reverb grouped', 'project').results[0];
		expect(project.path).toBe('audio/reverbGrouped');
		expect(await getExample(project.kind, project.path)).toBe(
			readFileSync(join(examplesRoot, 'src/projects/audio/reverbGrouped.8f4e'), 'utf8')
		);
	});

	it('browses both example collections with stable paths and no source payloads in search results', () => {
		for (const kind of ['block', 'project'] as const) {
			const paths: string[] = [];
			let offset: number | null = 0;
			while (offset !== null) {
				const result = searchExamples('', kind, offset);
				for (const match of result.results) {
					expect(match.kind).toBe(kind);
					expect(match).not.toHaveProperty('load');
					expect(match).not.toHaveProperty('code');
					paths.push(match.path);
				}
				offset = result.nextOffset;
			}
			expect(paths).toHaveLength(searchExamples('', kind).total);
			expect(new Set(paths).size).toBe(paths.length);
		}
		expect(searchExamples('noSuchExample9823')).toEqual({ results: [], total: 0, nextOffset: null });
	});

	it('rejects unknown topics, example paths, kinds, and invalid pagination', async () => {
		await expect(getDocs('../outside')).rejects.toMatchObject({ code: 'documentation_not_found' });
		await expect(getExample('block', '../outside')).rejects.toMatchObject({ code: 'example_not_found' });
		await expect(getExample('project', 'filters/lowPassFilter')).rejects.toMatchObject({ code: 'example_not_found' });
		await expect(getExample('other', 'filters/lowPassFilter')).rejects.toThrow('kind');
		expect(() => searchDocs(42)).toThrow('query');
		for (const offset of [-1, 0.5, '20']) expect(() => searchExamples('', undefined, offset)).toThrow('offset');
	});
});
