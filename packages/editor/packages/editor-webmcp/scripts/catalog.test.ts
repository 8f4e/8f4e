import { describe, expect, it } from 'vitest';
import { analyzeDocument, analyzeExamples } from './catalog.js';

describe('reference catalog analysis', () => {
	it('ignores fenced headings, keeps duplicate anchors distinct, and preserves enclosing context only for reads', () => {
		const source = [
			'# Language',
			'Root rules.',
			'```8f4e',
			'## Fenced heading',
			'```',
			'## Directives',
			'Parent prologue rules.',
			'### `#sample`',
			'~~~8f4e',
			'#sample',
			'~~~',
			'Use `float**` with `&buffer`.',
			'#### Restrictions',
			'Only in a module.',
			'### `#sample`',
			'A different description.',
		].join('\n');
		const entries = analyzeDocument('compiler/test', source);
		expect(entries.map(entry => entry.topic)).toEqual([
			'compiler/test',
			'compiler/test#directives',
			'compiler/test#sample',
			'compiler/test#sample-1',
		]);
		const sample = entries.find(entry => entry.topic === 'compiler/test#sample')!;
		expect(sample.summary).toBe('Use float** with &buffer.');
		expect(sample.terms).toContain('float**');
		expect(sample.terms).not.toContain('prologue');
		const read = sample.ranges.map(([start, end]) => source.split('\n').slice(start, end).join('\n')).join('\n\n');
		expect(read).toContain('Root rules.');
		expect(read).toContain('Parent prologue rules.');
		expect(read).toContain('Only in a module.');
		expect(read).not.toContain('A different description.');
	});

	it('extracts public blocks, indexes all prose, and resolves dependency paths without generated files', () => {
		const entries = analyzeExamples(
			'block',
			new Map([
				[
					'effects/crunch',
					'8f4e/v1\nentry main\nmodule crunch\n; @public\n; @pos 1 2\n; Lo-fi distortion.\n\n; Uses quantization levels.\nuse maths\nfloat out\nmoduleEnd\nentryEnd',
				],
				['constants/maths', '8f4e/v1\nconstants maths\n; @public\nconst FACTOR 2\nconstantsEnd'],
			])
		);
		expect(entries[0]).toMatchObject({
			kind: 'block',
			path: 'effects/crunch',
			title: 'Crunch',
			category: 'Effects',
			summary: 'Lo-fi distortion.',
			dependencies: ['constants/maths'],
		});
		expect(entries[0].terms).toContain('quantization');
		expect(entries[0].terms).not.toContain('@pos');
		expect(entries[0].source).toMatch(/^module crunch\n/);
		expect(entries[0].source).not.toContain('@public');
		expect(entries[0].source).not.toContain('entryEnd');
	});

	it('describes projects from notes while preserving source and allowing identical filenames in different categories', () => {
		const source =
			'8f4e/v1\nnote\n; @pos 3 4\n; @config runtime TestRuntime\nnoteEnd\nnote\n; Explain an audio effect.\nnoteEnd\n';
		const entries = analyzeExamples(
			'project',
			new Map([
				['audio/demo', source],
				['graphics/demo', source],
			])
		);
		expect(entries.map(entry => entry.category)).toEqual(['Audio', 'Graphics']);
		for (const entry of entries) {
			expect(entry.title).toBe('Demo');
			expect(entry.summary).toBe('Explain an audio effect.');
			expect(entry.terms).not.toContain('testruntime');
			expect(entry.source).toBe(source);
			expect(entry.dependencies).toEqual([]);
		}
	});
});
