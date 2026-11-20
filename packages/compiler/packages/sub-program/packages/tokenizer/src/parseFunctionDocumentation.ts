import type { FunctionAST, FunctionDocumentation } from '@8f4e/language-spec';

type DocumentationTag = { kind: 'doc' | 'returns'; text: string } | { kind: 'param'; name: string; text: string };

/** Recognizes a full-line documentation tag and keeps its entire payload as text. */
export function parseFunctionDocumentationTagLine(
	line: string
): { kind: 'doc' | 'param' | 'returns'; text: string } | undefined {
	const match = /^;\s*@(doc|param|returns)(?:\s+(.*))?$/.exec(line.trim());
	if (!match) return undefined;
	const [, kind, text = ''] = match;
	if (kind === 'doc' || kind === 'param' || kind === 'returns') return { kind, text };
}

/** Reads documentation from full-line comments inside a parsed function, without adding AST lines or syntax errors. */
export function parseFunctionDocumentation(
	code: readonly string[],
	ast: FunctionAST
): FunctionDocumentation | undefined {
	const parameterNames = new Set(ast.signature.parameters.map(parameter => parameter.name));
	const tags: DocumentationTag[] = [];
	let previousTag: DocumentationTag | undefined;
	for (let index = ast.functionLine.lineNumber + 1; index < ast.functionEndLine.lineNumber; index++) {
		const line = code[index].trim();
		const continuation = /^;\s*-(?:\s+(.*))?$/.exec(line);
		if (continuation) {
			const text = continuation[1]?.trim();
			if (previousTag && text) {
				previousTag.text = previousTag.text ? `${previousTag.text} ${text}` : text;
			}
			continue;
		}

		previousTag = undefined;
		const tag = parseFunctionDocumentationTagLine(line);
		if (!tag) continue;
		const { kind, text } = tag;
		if (kind === 'param') {
			const parameter = /^(\S+)(?:\s+(.*))?$/.exec(text);
			if (!parameter || !parameterNames.has(parameter[1])) continue;
			previousTag = { kind, name: parameter[1], text: parameter[2]?.trim() ?? '' };
		} else {
			previousTag = { kind, text: text.trim() };
		}
		if (previousTag) tags.push(previousTag);
	}

	let description: string | undefined;
	let returns: string | undefined;
	const parameters = new Map<string, string>();
	for (const tag of tags) {
		if (!tag.text) continue;
		switch (tag.kind) {
			case 'doc':
				description = tag.text;
				break;
			case 'param':
				parameters.set(tag.name, tag.text);
				break;
			case 'returns':
				returns = tag.text;
				break;
		}
	}
	if (!description && !parameters.size && !returns) return undefined;
	return {
		...(description ? { description } : {}),
		...(parameters.size ? { parameters: Object.fromEntries(parameters) } : {}),
		...(returns ? { returns } : {}),
	};
}
