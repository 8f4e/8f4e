import { parseProjectSource } from '@8f4e/compiler';
import { createModuleCatalog } from '@8f4e/editor-plugin-example-modules/catalog';
import extractPublicBlock from '@8f4e/editor-plugin-example-modules/public-block';
import { normalizeSearch, plainMarkdown } from '../src/reference-text.js';
import type { DocumentationEntry, ExampleEntry, ExampleKind } from '../src/reference-types.js';
import { scanMarkdown, summarizeMarkdown } from './markdown.js';

export type DocumentationMetadata = Omit<DocumentationEntry, 'load'>;
export type ExampleContent = Omit<ExampleEntry, 'load'> & { source: string };

function terms(source: string): string {
	return [...new Set(normalizeSearch(plainMarkdown(source)).split(' ').filter(Boolean))].join(' ');
}

export function analyzeDocument(topic: string, source: string): DocumentationMetadata[] {
	const lines = scanMarkdown(source);
	const headings: Array<{ start: number; level: number; title: string; anchor: string }> = [];
	const anchors = new Map<string, number>();
	for (const [start, line] of lines.entries()) {
		if (line.fenced || !line.heading || line.heading.level > 3 || line.heading.title === undefined) continue;
		const title = plainMarkdown(line.heading.title.replace(/\s*#*$/, ''));
		const slug = title
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-');
		const count = anchors.get(slug) ?? 0;
		anchors.set(slug, count + 1);
		headings.push({ start, level: line.heading.level, title, anchor: count ? `${slug}-${count}` : slug });
	}
	const entries: DocumentationMetadata[] = [];
	const add = (key: string, title: string, ranges: Array<[number, number]>) => {
		// Search and summarize the selected section; retain enclosing rules only for full reads.
		const [start, end] = ranges.at(-1)!;
		const section = lines.slice(start, end);
		entries.push({
			topic: key,
			title,
			summary: summarizeMarkdown(section),
			terms: terms(section.map(line => line.text).join('\n')),
			ranges,
		});
	};
	add(topic, headings[0]?.title ?? topic, [[0, lines.length]]);
	const introEnd = headings.find(heading => heading.level > 1)?.start ?? lines.length;
	for (const [index, heading] of headings.entries()) {
		if (heading.level === 1) continue;
		const end = headings.slice(index + 1).find(next => next.level <= heading.level)?.start ?? lines.length;
		const ranges: Array<[number, number]> = [[0, introEnd]];
		// Preserve enclosing sections' introductions, e.g. compiler-directive prologue rules.
		const parents: typeof headings = [];
		for (const parent of headings.slice(0, index)) {
			while (parents.length && parents.at(-1)!.level >= parent.level) parents.pop();
			parents.push(parent);
		}
		for (const parent of parents.filter(parent => parent.level > 1 && parent.level < heading.level)) {
			const next = headings.find(next => next.start > parent.start)!.start;
			ranges.push([parent.start, next]);
		}
		ranges.push([heading.start, end]);
		add(
			`${topic}#${heading.anchor}`,
			heading.title,
			ranges.filter(([start, end]) => start < end)
		);
	}
	return entries;
}

function commentParagraphs(code: string): string[] {
	return code
		.split('\n')
		.map(line => line.match(/^[ \t]*;[ \t]?(.*)$/)?.[1] ?? '')
		.map(line => (line.trimStart().startsWith('@') ? '' : line))
		.join('\n')
		.split(/\n\s*\n/)
		.filter(paragraph => paragraph.trim());
}

export function analyzeExamples(kind: ExampleKind, sources: ReadonlyMap<string, string>): ExampleContent[] {
	const paths = new Map([...sources.keys()].map(path => [path.split('/').at(-1)!, path]));
	// The shared catalog accepts lazy sources; analysis uses these only for names and dependencies.
	const loaders = new Map([...sources].map(([path, source]) => [path, async () => source]));
	const catalog = kind === 'block' ? createModuleCatalog(loaders) : undefined;
	return [...sources].map(([path, source]) => {
		const metadata = (catalog ?? createModuleCatalog(new Map([[path, loaders.get(path)!]]))).modules.find(
			item => item.slug === path.split('/').at(-1)
		)!;
		const code = kind === 'block' ? extractPublicBlock(source).join('\n') : source;
		const descriptions =
			kind === 'block'
				? commentParagraphs(code)
				: parseProjectSource(source)
						.notes.map(note =>
							note.code
								.slice(1, -1)
								.filter(line => !/^[ \t]*;[ \t]*@/.test(line))
								.map(line => line.replace(/^[ \t]*;[ \t]?/, ''))
								.join('\n')
						)
						.filter(note => note.trim());
		return {
			kind,
			path,
			title: metadata.title,
			category: metadata.category,
			summary: summarizeMarkdown(scanMarkdown(descriptions[0] ?? '')),
			terms: terms(descriptions.join('\n\n')),
			dependencies: catalog?.getDependenciesFromSource(metadata.slug, code).map(slug => paths.get(slug)!) ?? [],
			source: code,
		};
	});
}
