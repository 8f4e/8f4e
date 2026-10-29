import type { EditorDirectiveDefinition, ParsedDirectiveRecord, ParsedEditorDirective } from '@8f4e/editor-state-types';

export interface DirectiveComment {
	name: string;
	args: string[];
}

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

function parseDirectiveContinuationArgs(line: string): string[] | undefined {
	const continuationMatch = line.match(/^\s*;\s*-(?:\s+(.*))?$/);
	if (!continuationMatch) {
		return undefined;
	}

	const argsSegment = continuationMatch[1]?.trim();
	return argsSegment ? argsSegment.split(/\s+/) : [];
}

export function parseDirectiveLineRecords(line: string): ParsedDirectiveLineRecord[] {
	if (/^\s*;/.test(line)) {
		return parseDirectiveCommentSegment(line.replace(/^\s*;\s*/, ''), false);
	}

	const commentStart = line.indexOf(';');
	if (commentStart === -1) {
		return [];
	}

	return parseDirectiveCommentSegment(line.slice(commentStart + 1), true);
}

export function parseDirectiveRecords(code: string[]): ParsedDirectiveRecord[] {
	const records: ParsedDirectiveRecord[] = [];
	let previousRecord: ParsedDirectiveRecord | undefined;

	for (let sourceLineIndex = 0; sourceLineIndex < code.length; sourceLineIndex++) {
		const line = code[sourceLineIndex];
		const continuationArgs = parseDirectiveContinuationArgs(line);
		if (continuationArgs) {
			if (previousRecord && continuationArgs.length > 0) {
				previousRecord.args.push(...continuationArgs);
			}
			continue;
		}

		const lineRecords = parseDirectiveLineRecords(line).map(parsed => ({
			prefix: parsed.prefix,
			name: parsed.name,
			args: parsed.args,
			sourceLineIndex,
			sourceLine: line,
			isTrailing: parsed.isTrailing,
		}));

		if (lineRecords.length === 0) {
			previousRecord = undefined;
			continue;
		}

		records.push(...lineRecords);
		previousRecord = lineRecords[lineRecords.length - 1];
	}

	return records;
}

export function parseDirectiveComments(line: string): DirectiveComment[] {
	return parseDirectiveLineRecords(line).flatMap(parsed =>
		parsed.isTrailing ? [] : [{ name: parsed.name, args: parsed.args }]
	);
}

export function serializeDirectiveComments(directives: DirectiveComment[]): string | undefined {
	if (directives.length === 0) {
		return undefined;
	}

	return `; ${directives
		.map(({ name, args }) => (args.length > 0 ? `@${name} ${args.join(' ')}` : `@${name}`))
		.join(' ')}`;
}

export function createDirectiveDefinition(
	name: string,
	apply: NonNullable<EditorDirectiveDefinition['apply']>,
	options: Pick<EditorDirectiveDefinition, 'aliases' | 'allowTrailingComment' | 'clearDerivedBlockData'> = {}
): EditorDirectiveDefinition {
	return {
		name,
		...options,
		apply,
	};
}

/**
 * Shared alias-normalization helper. Filters `ParsedDirectiveRecord[]` to
 * editor (`@`) directives only, resolves aliases to canonical definition names, and
 * applies the `allowTrailingComment` gate for trailing records.
 *
 * Both `parseEditorDirectives` and `deriveDirectiveState` delegate to this so
 * alias normalization lives in exactly one place.
 */
export function normalizeEditorDirectiveRecords(
	records: ParsedDirectiveRecord[],
	definitions: EditorDirectiveDefinition[]
): ParsedEditorDirective[] {
	const definitionEntries = definitions.flatMap(definition =>
		[definition.name, ...(definition.aliases ?? [])].map(name => [name, definition] as const)
	);
	const definitionsByName = new Map(definitionEntries);

	return records.flatMap(record => {
		const definition = definitionsByName.get(record.name);
		if (!definition) {
			return [];
		}

		if (record.isTrailing && !definition.allowTrailingComment) {
			return [];
		}

		return [
			{
				name: definition.name,
				sourceLineIndex: record.sourceLineIndex,
				args: record.args,
				sourceLine: record.sourceLine,
			},
		];
	});
}

export function parseEditorDirectives(
	code: string[],
	definitions: EditorDirectiveDefinition[]
): ParsedEditorDirective[] {
	return normalizeEditorDirectiveRecords(parseDirectiveRecords(code), definitions);
}

export function hasDirective(code: string[], name: string): boolean {
	return code.some(line => parseDirectiveComments(line).some(directive => directive.name === name));
}
