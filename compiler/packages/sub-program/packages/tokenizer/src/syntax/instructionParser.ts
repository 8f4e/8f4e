/**
 * Regular expression for parsing instruction lines.
 * Matches an instruction keyword and the rest of the argument text, ignoring semicolon comments.
 * Full parsing uses the tokenizer in parser.ts; this regex is for lightweight instruction discovery.
 */
const instructionParser = /^\s*([^\s;]+)(?:\s+([^;]*?))?\s*(?:;.*)?$/;

export default instructionParser;
