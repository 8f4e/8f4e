export interface Format8f4eOptions {
	commentWidth: number;
}

const COMMENT_PREFIX = ';';

function findCommentDelimiter(line: string): number {
	let inString = false;
	for (let i = 0; i < line.length; i += 1) {
		const char = line[i];
		if (char === '\\' && inString) {
			i += 1;
			continue;
		}
		if (char === '"') {
			inString = !inString;
			continue;
		}
		if (char === COMMENT_PREFIX && !inString) {
			return i;
		}
	}
	return -1;
}

function splitLongWord(word: string, width: number): string[] {
	if (width <= 0 || word.length <= width) {
		return [word];
	}

	const chunks: string[] = [];
	for (let i = 0; i < word.length; i += width) {
		chunks.push(word.slice(i, i + width));
	}
	return chunks;
}

function wrapWords(text: string, width: number): string[] {
	const trimmed = text.trim();
	if (!trimmed) {
		return [''];
	}

	const lines: string[] = [];
	let current = '';

	for (const word of trimmed.split(/\s+/)) {
		if (current && current.length + 1 + word.length <= width) {
			current += ` ${word}`;
			continue;
		}

		if (current) {
			lines.push(current);
		}

		const chunks = splitLongWord(word, width);
		lines.push(...chunks.slice(0, -1));
		current = chunks[chunks.length - 1] ?? '';
	}

	if (current) {
		lines.push(current);
	}

	return lines;
}

function createCommentLine(prefix: string, text: string): string {
	return text ? `${prefix}${text}` : prefix.trimEnd();
}

function wrapCommentLine(line: string, commentWidth: number): string[] {
	const commentIndex = findCommentDelimiter(line);
	if (commentIndex === -1 || line.length <= commentWidth) {
		return [line];
	}

	const commentText = line.slice(commentIndex + 1).trim();
	if (commentText.startsWith('@')) {
		return [line];
	}

	const beforeComment = line.slice(0, commentIndex);
	const firstPrefix = `${beforeComment}${COMMENT_PREFIX} `;
	const continuationPrefix = `${' '.repeat(commentIndex)}${COMMENT_PREFIX} `;
	const firstTextWidth = Math.max(1, commentWidth - firstPrefix.length);
	const continuationTextWidth = Math.max(1, commentWidth - continuationPrefix.length);

	const [firstLineText = '', ...remainingText] = wrapWords(commentText, firstTextWidth);
	const wrappedLines = [createCommentLine(firstPrefix, firstLineText)];

	if (remainingText.length > 0) {
		for (const text of wrapWords(remainingText.join(' '), continuationTextWidth)) {
			wrappedLines.push(createCommentLine(continuationPrefix, text));
		}
	}

	return wrappedLines;
}

function detectLineEnding(input: string): string {
	return input.includes('\r\n') ? '\r\n' : '\n';
}

export function format8f4e(input: string, options: Format8f4eOptions): string {
	const lineEnding = detectLineEnding(input);
	const normalized = input.replace(/\r\n/g, '\n');
	const hasTrailingLineEnding = normalized.endsWith('\n');
	const lines = normalized.split('\n');
	if (hasTrailingLineEnding) {
		lines.pop();
	}

	const formatted = lines.flatMap(line => wrapCommentLine(line, options.commentWidth)).join(lineEnding);
	return hasTrailingLineEnding ? formatted + lineEnding : formatted;
}
