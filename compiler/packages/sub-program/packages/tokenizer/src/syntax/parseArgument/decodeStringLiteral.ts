import { SyntaxErrorCode, SyntaxIssue } from '../syntaxError';

/**
 * Decodes escape sequences in a raw (unquoted) string literal body.
 * Supported: \", \\, \n, \r, \t, \xNN.
 *
 * @param raw - String literal body without surrounding quotes.
 * @returns Decoded string literal value.
 */
export function decodeStringLiteral(raw: string): string {
	let result = '';
	let i = 0;
	while (i < raw.length) {
		if (raw[i] === '\\') {
			if (i + 1 >= raw.length) {
				throw new SyntaxIssue(SyntaxErrorCode.INVALID_STRING_LITERAL, `Unexpected end of string after backslash`);
			}
			const next = raw[i + 1];
			switch (next) {
				case '"':
					result += '"';
					i += 2;
					break;
				case '\\':
					result += '\\';
					i += 2;
					break;
				case 'n':
					result += '\n';
					i += 2;
					break;
				case 'r':
					result += '\r';
					i += 2;
					break;
				case 't':
					result += '\t';
					i += 2;
					break;
				case 'x': {
					const hex = raw.slice(i + 2, i + 4);
					if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
						throw new SyntaxIssue(SyntaxErrorCode.INVALID_STRING_LITERAL, `Invalid hex escape sequence: \\x${hex}`);
					}
					result += String.fromCharCode(parseInt(hex, 16));
					i += 4;
					break;
				}
				default:
					throw new SyntaxIssue(SyntaxErrorCode.INVALID_STRING_LITERAL, `Unknown escape sequence: \\${next}`);
			}
		} else {
			result += raw[i];
			i++;
		}
	}
	return result;
}
