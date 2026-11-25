/**
 * Wraps text into multiple lines so that each line does not exceed the given width.
 * Words are kept intact when possible; words longer than the width are split.
 * Existing newlines are treated as hard breaks.
 * @param text - The input text to wrap.
 * @param maxWidth - Maximum number of characters per line.
 * @returns Array of wrapped lines.
 */
export default function wrapText(text: string, maxWidth: number): string[] {
	if (maxWidth <= 0) {
		return [text];
	}

	const lines: string[] = [];
	const paragraphs = text.split(/\r?\n/);

	for (const paragraph of paragraphs) {
		if (paragraph === '') {
			lines.push('');
			continue;
		}

		const words = paragraph.split(/\s+/).filter(Boolean);
		let currentLine = '';

		const flushCurrentLine = () => {
			if (currentLine.length > 0) {
				lines.push(currentLine);
				currentLine = '';
			}
		};

		for (const word of words) {
			if (word.length > maxWidth) {
				flushCurrentLine();
				for (let i = 0; i < word.length; i += maxWidth) {
					lines.push(word.slice(i, i + maxWidth));
				}
				continue;
			}

			if (currentLine.length === 0) {
				currentLine = word;
			} else if (currentLine.length + 1 + word.length <= maxWidth) {
				currentLine = `${currentLine} ${word}`;
			} else {
				flushCurrentLine();
				currentLine = word;
			}
		}

		flushCurrentLine();
	}

	return lines;
}
