import { documentation, examples, helpText } from './generated/catalog.js';
import { normalizeSearch } from './reference-text.js';
import type { ExampleKind } from './reference-types.js';
import { toolError } from './tool.js';

const pageSize = 20;
const documentationByTopic = new Map(documentation.map(entry => [entry.topic, entry]));
const examplesByPath = new Map(examples.map(entry => [`${entry.kind}:${entry.path}`, entry]));

function queryWords(query: unknown): string[] {
	if (typeof query !== 'string') throw new Error('query must be a string; use an empty string to browse');
	return normalizeSearch(query).split(' ').filter(Boolean);
}
function page<T>(results: T[], offset: unknown) {
	if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0)
		throw new Error('offset must be a nonnegative integer');
	return {
		results: results.slice(offset, offset + pageSize),
		total: results.length,
		nextOffset: offset + pageSize < results.length ? offset + pageSize : null,
	};
}
function score(words: string[], title: string, text: string): number {
	const normalizedTitle = normalizeSearch(title);
	const haystack = `${normalizedTitle} ${normalizeSearch(text)}`;
	if (!words.every(word => haystack.includes(word))) return -1;
	return (normalizedTitle === words.join(' ') ? 100 : 0) + words.filter(word => normalizedTitle.includes(word)).length;
}
function exampleKind(kind: unknown): ExampleKind {
	if (kind !== 'block' && kind !== 'project') throw new Error('kind must be block or project');
	return kind;
}

export function getHelp(): string {
	return helpText;
}

export function searchDocs(query: unknown, offset: unknown = 0) {
	const words = queryWords(query);
	const matches = documentation
		.map(entry => ({ entry, score: score(words, entry.title, `${entry.topic} ${entry.terms}`) }))
		.filter(match => match.score >= 0)
		.sort((a, b) => b.score - a.score || a.entry.topic.localeCompare(b.entry.topic))
		.map(({ entry: { topic, title, summary } }) => ({ topic, title, summary }));
	return page(matches, offset);
}

export async function getDocs(topic: unknown): Promise<string> {
	if (typeof topic !== 'string') throw new Error('topic must be a topic returned by search_docs');
	const entry = documentationByTopic.get(topic);
	if (!entry) return toolError('documentation_not_found', 'Unknown documentation topic; use search_docs to find one');
	const lines = (await entry.load()).split('\n');
	return entry.ranges.map(([start, end]) => lines.slice(start, end).join('\n')).join('\n\n');
}

export function searchExamples(query: unknown, kind?: unknown, offset: unknown = 0) {
	const words = queryWords(query);
	const filter = kind === undefined ? undefined : exampleKind(kind);
	const matches = examples
		.filter(entry => filter === undefined || entry.kind === filter)
		.map(entry => ({ entry, score: score(words, entry.title, `${entry.path} ${entry.category} ${entry.terms}`) }))
		.filter(match => match.score >= 0)
		.sort(
			(a, b) =>
				b.score - a.score || a.entry.kind.localeCompare(b.entry.kind) || a.entry.path.localeCompare(b.entry.path)
		)
		.map(({ entry: { load: _load, terms: _terms, ...metadata } }) => metadata);
	return page(matches, offset);
}

export async function getExample(kind: unknown, path: unknown): Promise<string> {
	const selectedKind = exampleKind(kind);
	if (typeof path !== 'string') throw new Error('path must be a path returned by search_examples');
	const entry = examplesByPath.get(`${selectedKind}:${path}`);
	if (!entry) return toolError('example_not_found', 'Unknown example; use search_examples to find its kind and path');
	return entry.load();
}
