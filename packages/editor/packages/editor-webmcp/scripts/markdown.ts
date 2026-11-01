import { plainMarkdown } from '../src/reference-text.js';

interface MarkdownLine {
	text: string;
	fenced: boolean;
	heading?: { level: number; title: string | undefined };
}

/** Share fence and heading detection between topic outlines and section summaries. */
export function scanMarkdown(source: string): MarkdownLine[] {
	let fence: string | undefined;
	return source.split('\n').map(text => {
		const marker = text.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
		const fenced = Boolean(fence || marker);
		if (marker) {
			if (!fence) fence = marker[1][0];
			else if (marker[1][0] === fence) fence = undefined;
		}
		const heading = text.match(/^(#{1,6})\s/);
		return {
			text,
			fenced,
			...(heading ? { heading: { level: heading[1].length, title: text.match(/^#{1,6}\s+(.+)$/)?.[1] } } : {}),
		};
	});
}

export function summarizeMarkdown(lines: MarkdownLine[]): string {
	const paragraph: string[] = [];
	let headingSeen = false;
	for (const line of lines) {
		if (line.fenced) continue;
		if (line.heading) {
			if (headingSeen || paragraph.length) break;
			headingSeen = true;
			continue;
		}
		if (!line.text.trim()) {
			if (paragraph.length) break;
			continue;
		}
		paragraph.push(line.text);
	}
	const text = paragraph.length
		? plainMarkdown(paragraph.join(' '))
		: lines
				.flatMap(line => (line.heading?.title === undefined ? [] : [plainMarkdown(line.heading.title)]))
				.slice(1)
				.join(', ');
	return text.length <= 200 ? text : `${text.slice(0, 197).replace(/\s+\S*$/, '')}…`;
}
