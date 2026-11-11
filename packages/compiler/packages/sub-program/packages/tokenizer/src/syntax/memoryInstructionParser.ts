import type { Argument, ArgumentLiteral, ArgumentStringLiteral, EndAddressIdentifier } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { SyntaxErrorCode, SyntaxIssue } from './syntaxError';

/**
 * A single token within a split-byte sequence.
 * May be a resolved byte literal or an identifier to be resolved as a compile-time constant.
 */
export type SplitByteToken = { type: 'literal'; value: number } | { type: 'identifier'; value: string };

export type MemoryArgumentShape =
	| { type: 'literal'; value: number }
	| { type: 'end-query'; query: EndAddressIdentifier }
	| { type: 'identifier'; value: string }
	| { type: 'constant-identifier'; value: string }
	| { type: 'split-byte-tokens'; tokens: SplitByteToken[] }
	| { type: 'memory-reference'; base: string; pattern: string }
	| { type: 'element-count'; base: string }
	| { type: 'intermodular-reference'; pattern: string }
	| {
			type: 'intermodular-module-reference';
			module: string;
			pattern: string;
	  }
	| {
			type: 'intermodular-element-count';
			module: string;
			memory: string;
			pattern: string;
	  }
	| {
			type: 'intermodular-element-word-size';
			module: string;
			memory: string;
			pattern: string;
	  }
	| {
			type: 'intermodular-element-max';
			module: string;
			memory: string;
			pattern: string;
	  }
	| {
			type: 'intermodular-element-min';
			module: string;
			memory: string;
			pattern: string;
	  };

export interface ParsedMemoryInstructionArguments {
	firstArg: MemoryArgumentShape;
	secondArg?: MemoryArgumentShape;
}

/**
 * Returns true when the argument is a byte-sized integer literal (0–255) in any numeric form
 * (decimal, hexadecimal, or binary).
 */
function isByteLiteral(arg: Argument): arg is ArgumentLiteral & { type: typeof ArgumentType.LITERAL; isInteger: true } {
	return arg.type === ArgumentType.LITERAL && arg.isInteger === true && arg.value >= 0 && arg.value <= 255;
}

/**
 * Converts a decoded string literal into declaration bytes, matching `push "..."`
 * string-literal byte semantics.
 */
function stringLiteralToBytes(arg: ArgumentStringLiteral): number[] {
	return Array.from(arg.value, ch => ch.charCodeAt(0) & 0xff);
}

function isNonEmptyStringLiteral(arg: Argument): arg is ArgumentStringLiteral {
	return arg.type === ArgumentType.STRING_LITERAL && arg.value.length > 0;
}

/**
 * Returns true when the argument can participate in a split-byte sequence:
 * either a byte-sized integer literal (0–255) or a plain or constant-style identifier.
 * Plain and constant-style identifiers are expected to be resolved as compile-time constants
 * in the semantic phase.
 */
function isSplitByteCandidate(arg: Argument): boolean {
	if (isByteLiteral(arg)) return true;
	if (isNonEmptyStringLiteral(arg)) return true;
	if (arg.type !== ArgumentType.IDENTIFIER) return false;
	// Only plain and constant-style identifiers are valid split-byte participants.
	// All other reference kinds (memory-reference, element-count, intermodular-*, etc.) are excluded.
	return arg.referenceKind === 'plain' || arg.referenceKind === 'constant';
}

/**
 * Converts an argument known to be a valid split-byte candidate into a SplitByteToken.
 */
function toSplitByteTokens(arg: Argument): SplitByteToken[] {
	if (arg.type === ArgumentType.LITERAL) {
		return [{ type: 'literal', value: (arg as ArgumentLiteral).value }];
	}
	if (arg.type === ArgumentType.STRING_LITERAL) {
		return stringLiteralToBytes(arg).map(value => ({ type: 'literal', value }));
	}
	return [{ type: 'identifier', value: (arg as { value: string }).value }];
}

/**
 * Collects all arguments from position `start` onward as split-byte tokens.
 * Throws SPLIT_HEX_MIXED_TOKENS if any argument is not a valid split-byte candidate.
 */
function collectSplitByteTokens(args: Array<Argument>, start: number): SplitByteToken[] {
	const tokens: SplitByteToken[] = [];
	for (let i = start; i < args.length; i++) {
		if (!isSplitByteCandidate(args[i])) {
			throw new SyntaxIssue(SyntaxErrorCode.SPLIT_HEX_MIXED_TOKENS);
		}
		tokens.push(...toSplitByteTokens(args[i]));
	}
	return tokens;
}

/**
 * Parses memory instruction arguments at the syntax level.
 * This function classifies argument shapes without touching compiler state or performing semantic validation
 * (e.g., it does not look up constants or memory names). The one exception is the constant-style identifier
 * check (`isConstantName`), which is a pure naming-convention rule applied to token text alone and requires
 * no compiler state — it disambiguates anonymous declarations at the syntax level so that `int HI LO` is
 * always treated as an anonymous split-byte declaration and never as a named allocation.
 *
 * Split-byte detection rules:
 * - Two or more tokens that are byte literals or plain identifiers form a split-byte sequence (split-byte-tokens).
 * - Constant-style identifiers (all-uppercase, matching isConstantName) are treated as anonymous starts and
 *   cannot be used as memory names. When followed by more tokens, they start a split-byte sequence.
 * - Named declarations (non-constant-style identifier as first arg) collect 2+ following tokens as split-byte-tokens.
 * - A single token in any position is not treated as split-byte.
 *
 * @param args - Array of parsed arguments
 * @returns Parsed memory instruction arguments with shape information
 * @throws {SyntaxIssue} If required arguments are missing or the token sequence is invalid
 */
export function parseMemoryInstructionArgumentsShape(args: Array<Argument>): ParsedMemoryInstructionArguments {
	if (!args[0]) {
		throw new SyntaxIssue(SyntaxErrorCode.MISSING_ARGUMENT);
	}

	const result: ParsedMemoryInstructionArguments = {
		firstArg: classifyArgument(args[0]),
	};

	// Anonymous path — starts with a string literal. A single string literal becomes
	// either a single literal byte or a packed split-byte sequence. When followed by
	// more byte-resolving tokens, flatten all of them into one split-byte sequence.
	if (args[0].type === ArgumentType.STRING_LITERAL) {
		if (args[1]) {
			if (!isSplitByteCandidate(args[1])) {
				throw new SyntaxIssue(SyntaxErrorCode.SPLIT_HEX_MIXED_TOKENS);
			}
			result.firstArg = { type: 'split-byte-tokens', tokens: collectSplitByteTokens(args, 0) };
		}
		return result;
	}

	// Case A: Anonymous path — starts with a byte-sized integer literal (0–255)
	if (result.firstArg.type === 'literal' && isByteLiteral(args[0])) {
		if (args[1]) {
			if (!isSplitByteCandidate(args[1])) {
				throw new SyntaxIssue(SyntaxErrorCode.SPLIT_HEX_MIXED_TOKENS);
			}
			// Two or more tokens: collect all as split-byte-tokens
			const tokens: SplitByteToken[] = [
				{ type: 'literal', value: (args[0] as ArgumentLiteral).value },
				...collectSplitByteTokens(args, 1),
			];
			result.firstArg = { type: 'split-byte-tokens', tokens };
		}
		return result;
	}

	// Case B: Anonymous path — out-of-range literal followed by extra args (reject to prevent silent miscompilation)
	if (result.firstArg.type === 'literal' && args[1]) {
		throw new SyntaxIssue(SyntaxErrorCode.SPLIT_HEX_MIXED_TOKENS);
	}

	// Case C: Anonymous path — starts with a constant-style identifier.
	// Constant-style names (all-uppercase) cannot be memory allocation names; treat as anonymous.
	// When followed by additional tokens they form a split-byte sequence.
	// A single constant-style identifier is marked as 'constant-identifier' so the semantic phase
	// can emit the appropriate CONSTANT_NAME_AS_MEMORY_IDENTIFIER error rather than silently
	// treating it as a named allocation.
	if (
		result.firstArg.type === 'identifier' &&
		args[0].type === ArgumentType.IDENTIFIER &&
		args[0].referenceKind === 'constant'
	) {
		if (args[1]) {
			if (!isSplitByteCandidate(args[1])) {
				throw new SyntaxIssue(SyntaxErrorCode.SPLIT_HEX_MIXED_TOKENS);
			}
			// Two or more tokens: collect all as split-byte-tokens
			const tokens: SplitByteToken[] = [
				{ type: 'identifier', value: result.firstArg.value },
				...collectSplitByteTokens(args, 1),
			];
			result.firstArg = { type: 'split-byte-tokens', tokens };
		} else {
			// Single constant-style identifier: mark explicitly so the semantic phase can reject it.
			result.firstArg = { type: 'constant-identifier', value: result.firstArg.value };
		}
		return result;
	}

	// Case D: Named declaration — non-constant-style identifier as first arg.
	if (result.firstArg.type === 'identifier') {
		if (args[2]) {
			// Two or more default tokens: all must be split-byte candidates
			const tokens = collectSplitByteTokens(args, 1);
			result.secondArg = { type: 'split-byte-tokens', tokens };
		} else if (args[1]) {
			// Single default token: classify normally
			result.secondArg = classifyArgument(args[1]);
		}
		return result;
	}

	// Case E: Non-identifier first arg (special references, etc.) — classify second arg if present
	if (args[1]) {
		result.secondArg = classifyArgument(args[1]);
	}

	return result;
}

function classifyArgument(arg: Argument): MemoryArgumentShape {
	if (arg.type === ArgumentType.LITERAL) {
		return {
			type: 'literal',
			value: arg.value,
		};
	}

	if (arg.type === ArgumentType.STRING_LITERAL) {
		const bytes = stringLiteralToBytes(arg);
		if (bytes.length <= 1) {
			return {
				type: 'literal',
				value: bytes[0] ?? 0,
			};
		}
		return {
			type: 'split-byte-tokens',
			tokens: bytes.map(value => ({ type: 'literal', value })),
		};
	}

	if (arg.type !== ArgumentType.IDENTIFIER) {
		throw new SyntaxIssue(SyntaxErrorCode.MISSING_ARGUMENT);
	}

	// Use the pre-classified referenceKind and extracted fields from the ArgumentIdentifier
	// instead of re-detecting patterns from raw strings.
	switch (arg.referenceKind) {
		case 'end-address':
			return { type: 'end-query', query: arg };
		case 'intermodular-reference':
			return {
				type: 'intermodular-reference',
				pattern: arg.value,
			};
		case 'intermodular-module-reference':
			return {
				type: 'intermodular-module-reference',
				module: arg.targetModuleId,
				pattern: arg.value,
			};
		case 'intermodular-element-count':
			return {
				type: 'intermodular-element-count',
				module: arg.targetModuleId,
				memory: arg.targetMemoryId,
				pattern: arg.value,
			};
		case 'intermodular-element-word-size':
			return {
				type: 'intermodular-element-word-size',
				module: arg.targetModuleId,
				memory: arg.targetMemoryId,
				pattern: arg.value,
			};
		case 'intermodular-element-max':
			return {
				type: 'intermodular-element-max',
				module: arg.targetModuleId,
				memory: arg.targetMemoryId,
				pattern: arg.value,
			};
		case 'intermodular-element-min':
			return {
				type: 'intermodular-element-min',
				module: arg.targetModuleId,
				memory: arg.targetMemoryId,
				pattern: arg.value,
			};
		case 'memory-reference':
			return {
				type: 'memory-reference',
				base: arg.targetMemoryId,
				pattern: arg.value,
			};
		case 'element-count':
			return {
				type: 'element-count',
				base: arg.targetMemoryId,
			};
		default:
			return {
				type: 'identifier',
				value: arg.value,
			};
	}
}
