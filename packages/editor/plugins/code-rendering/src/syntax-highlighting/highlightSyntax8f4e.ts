import { knownInstructionNameSet } from '@8f4e/language-spec';
import highlightEditorDirective from './highlightEditorDirective';
import type { SyntaxFonts, SyntaxHighlighting } from './types';

const instructionRegExp = new RegExp(
	'(?<=^|\\s)(?:' +
		[...knownInstructionNameSet]
			.sort((a, b) => b.length - a.length)
			.join('|')
			.replaceAll(/\*/g, '\\*')
			.replaceAll(/\]/g, '\\]')
			.replaceAll(/\[/g, '\\[') +
		')(?=\\s|$)'
);

export default function highlightSyntax8f4e<T>(code: string[], fonts: SyntaxFonts<T>): SyntaxHighlighting<T> {
	return code.map(line => {
		const semicolonIndex = line.indexOf(';');
		const hashCommentMatch = /^\s*#/.exec(line);
		const hashCommentIndex = hashCommentMatch ? hashCommentMatch[0].length - 1 : -1;
		const commentIndex =
			semicolonIndex === -1
				? hashCommentIndex === -1
					? undefined
					: hashCommentIndex
				: hashCommentIndex === -1
					? semicolonIndex
					: Math.min(semicolonIndex, hashCommentIndex);
		const instructionMatch = instructionRegExp.exec(line);
		const colors = new Array<T | undefined>(line.length).fill(undefined);
		const isBeforeComment = (index: number) => commentIndex === undefined || index < commentIndex;
		const defaultColorAt = (index: number) =>
			line[index] === '\t' || commentIndex === index ? fonts.fontCodeComment : fonts.fontCode;

		if (instructionMatch && isBeforeComment(instructionMatch.index)) {
			colors[instructionMatch.index] = fonts.fontInstruction;
			colors[instructionMatch.index + instructionMatch[0].length] = fonts.fontCode;
		}
		if (commentIndex !== undefined) colors[commentIndex] = fonts.fontCodeComment;

		for (let index = 0; index < line.length; index += 1) {
			if (line[index] === '\t') {
				colors[index] = fonts.fontCodeComment;
				if (index + 1 < line.length) colors[index + 1] = defaultColorAt(index + 1);
			}
		}

		for (const match of line.matchAll(/(?<![#\w])-?(?:\d+|0b[01]+|0x[\da-f]+)\b/gi)) {
			if (isBeforeComment(match.index)) {
				colors[match.index] = fonts.fontNumbers;
				const end = match.index + match[0].length;
				if (end < line.length) colors[end] = defaultColorAt(end);
			}
		}

		for (const match of line.matchAll(/0b([01]+)/g)) {
			if (!isBeforeComment(match.index)) continue;
			colors[match.index] = fonts.fontBasePrefix;
			for (let index = 0; index < match[1].length; index += 1) {
				colors[match.index + index + 2] = match[1][index] === '0' ? fonts.fontBinaryZero : fonts.fontBinaryOne;
			}
		}

		for (const match of line.matchAll(/0x([\da-f]+)/gi)) {
			if (!isBeforeComment(match.index)) continue;
			colors[match.index] = fonts.fontBasePrefix;
			colors[match.index + 2] = fonts.fontNumbers;
		}

		highlightEditorDirective(line, colors, fonts.fontCode, fonts.fontCodeComment);
		return colors;
	});
}
