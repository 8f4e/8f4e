import { parseFunctionDocumentationTagLine } from './parseFunctionDocumentation';

type ParsedDirectiveLineRecord = { prefix: '@'; name: string; args: string[]; isTrailing: boolean };

function parseDirectiveCommentSegment(segment: string, isTrailing: boolean): ParsedDirectiveLineRecord[] {
	const trimmed = segment.trim();
	if (!trimmed) {
		return [];
	}

	const tokens = trimmed.split(/\s+/);
	const directives: ParsedDirectiveLineRecord[] = [];
	let current: ParsedDirectiveLineRecord | undefined;

	for (const token of tokens) {
		const directiveMatch = token.match(/^@(\w+)$/);
		if (directiveMatch) {
			const [, name] = directiveMatch;

			if (current) {
				directives.push(current);
			}

			current = {
				prefix: '@',
				name,
				args: [],
				isTrailing,
			};
			continue;
		}

		if (!current) {
			return [];
		}

		current.args.push(token);
	}

	if (current) {
		directives.push(current);
	}

	return directives;
}

/** Scans standalone or trailing directive comments, leaving directive interpretation to the caller. */
export function parseDirectiveLineRecords(line: string): ParsedDirectiveLineRecord[] {
	if (/^\s*;/.test(line)) {
		// Function documentation is not an editor directive; its prose may itself contain @-prefixed words.
		if (parseFunctionDocumentationTagLine(line)) return [];
		return parseDirectiveCommentSegment(line.replace(/^\s*;\s*/, ''), false);
	}

	const commentStart = line.indexOf(';');
	if (commentStart === -1) {
		return [];
	}

	return parseDirectiveCommentSegment(line.slice(commentStart + 1), true);
}
