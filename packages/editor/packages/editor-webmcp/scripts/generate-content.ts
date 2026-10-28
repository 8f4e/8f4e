import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import blockSources from 'virtual:8f4e-sources/reference-blocks';
import compilerDocs from 'virtual:8f4e-sources/reference-compiler';
import editorDocs from 'virtual:8f4e-sources/reference-editor';
import projectSources from 'virtual:8f4e-sources/reference-projects';
import { parseProjectSource } from '@8f4e/compiler';
import { createModuleCatalog } from '@8f4e/editor-plugin-example-modules/catalog';
import extractPublicBlock from '@8f4e/editor-plugin-example-modules/public-block';
import { normalizeSearch, plainMarkdown } from '../src/reference-text.js';
import type { DocumentationEntry, ExampleEntry, ExampleKind } from '../src/reference-types.js';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const output = join(packageRoot, 'src/generated');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

type Doc = Omit<DocumentationEntry, 'load'> & { file: string };
type Example = Omit<ExampleEntry, 'load'> & { file: string };
const docs: Doc[] = [];
const examples: Example[] = [];
let fileIndex = 0;
function content(source: string): string {
	const file = `content-${fileIndex++}.js`;
	writeFileSync(join(output, file.replace(/\.js$/, '.ts')), `export default ${JSON.stringify(source)};\n`);
	return file;
}
function summary(source: string): string {
	const paragraph: string[] = [];
	let fence: string | undefined;
	let headingSeen = false;
	for (const line of source.split('\n')) {
		const marker = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
		if (marker) {
			if (!fence) fence = marker[1][0];
			else if (marker[1][0] === fence) fence = undefined;
			continue;
		}
		if (fence) continue;
		if (/^#{1,6}\s/.test(line)) {
			if (headingSeen || paragraph.length) break;
			headingSeen = true;
			continue;
		}
		if (!line.trim()) {
			if (paragraph.length) break;
			continue;
		}
		paragraph.push(line);
	}
	const text = paragraph.length
		? plainMarkdown(paragraph.join(' '))
		: [...source.matchAll(/^#{1,6}\s+(.+)$/gm)]
				.slice(1)
				.map(match => plainMarkdown(match[1]))
				.join(', ');
	return text.length <= 200 ? text : `${text.slice(0, 197).replace(/\s+\S*$/, '')}…`;
}
function terms(source: string): string {
	return [...new Set(normalizeSearch(plainMarkdown(source)).split(' ').filter(Boolean))].join(' ');
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
function addDocument(topic: string, source: string) {
	const file = content(source);
	const lines = source.split('\n');
	const headings: Array<{ start: number; level: number; title: string; anchor: string }> = [];
	const anchors = new Map<string, number>();
	let fence: string | undefined;
	for (const [start, line] of lines.entries()) {
		const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
		if (marker) {
			if (!fence) fence = marker[1][0];
			else if (marker[1][0] === fence) fence = undefined;
			continue;
		}
		if (fence) continue;
		const match = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
		if (!match) continue;
		const title = plainMarkdown(match[2]);
		const slug = title
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-');
		const count = anchors.get(slug) ?? 0;
		anchors.set(slug, count + 1);
		headings.push({ start, level: match[1].length, title, anchor: count ? `${slug}-${count}` : slug });
	}
	const add = (key: string, title: string, ranges: Array<[number, number]>) => {
		// Search and summarize the selected section; retain enclosing rules only for full reads.
		const [start, end] = ranges.at(-1)!;
		const text = lines.slice(start, end).join('\n');
		docs.push({ topic: key, title, summary: summary(text), terms: terms(text), ranges, file });
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
}

for (const [prefix, sources] of [
	['compiler', compilerDocs],
	['editor', editorDocs],
] as const) {
	for (const [path, load] of sources) {
		addDocument(`${prefix}/${path}`, await load());
	}
}
const helpText = readFileSync(join(packageRoot, 'help.md'), 'utf8');
addDocument('bridge/help', helpText);

for (const [kind, sources] of [
	['block', blockSources],
	['project', projectSources],
] satisfies Array<[ExampleKind, ReadonlyMap<string, () => Promise<string>>]>) {
	const paths = new Map([...sources.keys()].map(path => [path.split('/').at(-1)!, path]));
	const catalog = kind === 'block' ? createModuleCatalog(sources) : undefined;
	for (const [path, load] of sources) {
		const metadata = (catalog ?? createModuleCatalog(new Map([[path, load]]))).modules.find(
			item => item.slug === path.split('/').at(-1)
		)!;
		const source = await load();
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
		examples.push({
			kind,
			path,
			title: metadata.title,
			category: metadata.category,
			summary: summary(descriptions[0] ?? ''),
			terms: terms(descriptions.join('\n\n')),
			dependencies: catalog?.getDependenciesFromSource(metadata.slug, code).map(slug => paths.get(slug)!) ?? [],
			file: content(code),
		});
	}
}

function entries(items: Array<Doc | Example>): string {
	return items
		.map(
			({ file, ...metadata }) =>
				`${JSON.stringify(metadata).slice(0, -1)}, load: () => import('./${file}').then(module => module.default)}`
		)
		.join(',\n');
}
writeFileSync(
	join(output, 'catalog.ts'),
	[
		"import type { DocumentationEntry, ExampleEntry } from '../reference-types.js';",
		`export const helpText = ${JSON.stringify(helpText)};`,
		`export const documentation: DocumentationEntry[] = [${entries(docs)}];`,
		`export const examples: ExampleEntry[] = [${entries(examples)}];`,
	].join('\n')
);
process.stdout.write(
	`Bundled ${docs.length} documentation topics and ${examples.length} examples in ${relative(packageRoot, output)}\n`
);
