import type { ProjectGroupPath, SourceMetadata } from '@8f4e/language-spec';

/**
 * Syntax errors — raised when source structure is invalid before semantic analysis.
 *
 * Use this module for errors that can be detected from token or argument shape alone,
 * without requiring symbol resolution, scope validation, stack state, type checking,
 * or any other compiler state:
 *   - malformed literal syntax (e.g. division by zero in a literal fraction)
 *   - missing required argument shape
 *   - invalid declaration shape
 *   - invalid pointer-depth syntax
 *   - malformed prefix/suffix syntax
 *   - invalid string literal encoding
 *
 * Boundary rule:
 *   If the error can be detected before building semantic context → it belongs here.
 *   If detecting it requires symbol resolution, scope, stack state, or type knowledge
 *   → use ErrorCode / getError from @8f4e/language-spec.
 */

export const SyntaxErrorCode = {
	INVALID_MEMORY_IDENTIFIER_PREFIX: 0,
	INVALID_IDENTIFIER: 1,
	INVALID_ARGUMENT: 2,
	INVALID_NUMERIC_LITERAL: 3,
	INVALID_POINTER_DEPTH: 4,
	MISSING_ARGUMENT: 5,
	DIVISION_BY_ZERO: 6,
	INVALID_STRING_LITERAL: 7,
	SPLIT_HEX_MIXED_TOKENS: 8,
	INVALID_BLOCK_STRUCTURE: 9,
	COMPILER_DIRECTIVE_MUST_BE_PROLOGUE: 10,
	UNRECOGNISED_INSTRUCTION: 11,
	INSTRUCTION_NOT_ALLOWED_IN_BLOCK: 12,
	DUPLICATE_FUNCTION_EXPORT: 13,
	DUPLICATE_FUNCTION_IMPORT: 14,
	IMPORT_EXPORT_CONFLICT: 15,
	IMPORTED_FUNCTION_BODY: 16,
	PARAM_AFTER_FUNCTION_BODY: 17,
	INVALID_PROJECT_MEMORY_INITIALIZER: 18,
	INVALID_REFERENCE_SLOT: 19,
	INVALID_TEMPLATE_NAME: 20,
	MULTIPLE_TEMPLATE_REFERENCES: 21,
	TEMPLATE_INSTANCE_HAS_CONTENT: 22,
	INVALID_TEMPLATE_CONTENT: 23,
} as const;

export type SyntaxErrorCodeValue = (typeof SyntaxErrorCode)[keyof typeof SyntaxErrorCode];

/**
 * Default messages for each syntax error code.
 * Throw sites that do not need a custom message can omit the message argument
 * and this registry will supply the default.
 */
const SyntaxErrorMessages: Record<SyntaxErrorCodeValue, string> = {
	[SyntaxErrorCode.INVALID_TEMPLATE_NAME]:
		'template and useTemplate require exactly one name matching [A-Za-z_][A-Za-z0-9_-]*.',
	[SyntaxErrorCode.MULTIPLE_TEMPLATE_REFERENCES]: 'A group may contain only one useTemplate instruction.',
	[SyntaxErrorCode.TEMPLATE_INSTANCE_HAS_CONTENT]:
		'A source group using a template cannot also contain child blocks or entries.',
	[SyntaxErrorCode.INVALID_TEMPLATE_CONTENT]: 'A template body may contain only child blocks, entries, and comments.',
	[SyntaxErrorCode.INVALID_REFERENCE_SLOT]:
		'A fixed reference requires a non-constant name and a memory start address: <type>& <name> &<memory>, &<module>:<memory>, or &<module>:<index>.',
	[SyntaxErrorCode.INVALID_MEMORY_IDENTIFIER_PREFIX]: 'Invalid memory identifier prefix.',
	[SyntaxErrorCode.INVALID_IDENTIFIER]: 'Invalid identifier.',
	[SyntaxErrorCode.INVALID_ARGUMENT]: 'Invalid instruction argument.',
	[SyntaxErrorCode.INVALID_NUMERIC_LITERAL]: 'Invalid numeric literal or expression.',
	[SyntaxErrorCode.INVALID_POINTER_DEPTH]: 'Invalid pointer depth.',
	[SyntaxErrorCode.MISSING_ARGUMENT]: 'Missing required argument.',
	[SyntaxErrorCode.DIVISION_BY_ZERO]: 'Division by zero in literal expression.',
	[SyntaxErrorCode.INVALID_STRING_LITERAL]: 'Invalid string literal.',
	[SyntaxErrorCode.SPLIT_HEX_MIXED_TOKENS]:
		'Split-byte default values must consist entirely of byte-resolving tokens: integer literals (0–255), literal-only * or / expressions that fold to an integer in that range, or constant-style identifiers. Memory references and non-byte-resolving forms are not allowed in split-byte sequences.',
	[SyntaxErrorCode.INVALID_BLOCK_STRUCTURE]: 'Invalid block structure.',
	[SyntaxErrorCode.COMPILER_DIRECTIVE_MUST_BE_PROLOGUE]:
		'Compiler directives must appear in the block prologue, immediately after module or function.',
	[SyntaxErrorCode.UNRECOGNISED_INSTRUCTION]: 'Unrecognised instruction.',
	[SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK]: 'Instruction is not allowed in this block.',
	[SyntaxErrorCode.DUPLICATE_FUNCTION_EXPORT]: 'A function may only declare one export directive.',
	[SyntaxErrorCode.DUPLICATE_FUNCTION_IMPORT]: 'A function may only declare one import directive.',
	[SyntaxErrorCode.IMPORT_EXPORT_CONFLICT]: 'A function cannot be both imported and exported.',
	[SyntaxErrorCode.IMPORTED_FUNCTION_BODY]: 'An imported function cannot have an executable body.',
	[SyntaxErrorCode.PARAM_AFTER_FUNCTION_BODY]: 'Parameters must be declared before the function body.',
	[SyntaxErrorCode.INVALID_PROJECT_MEMORY_INITIALIZER]:
		'Expected "init &<exposed-memory> <number>" or "init &<exposed-memory> &<module>:<memory>".',
};

export interface SyntaxErrorLine {
	lineNumber: number;
	instruction?: string;
	arguments?: unknown[];
}

export interface SyntaxErrorContext {
	projectBlockId?: number;
	projectGroupPath?: ProjectGroupPath;
	source?: SourceMetadata;
}

export class SyntaxRulesError extends Error {
	constructor(
		public code: SyntaxErrorCodeValue,
		message?: string,
		public line?: SyntaxErrorLine,
		public context?: SyntaxErrorContext
	) {
		super(message ?? SyntaxErrorMessages[code]);
		this.name = 'SyntaxRulesError';
	}
}
