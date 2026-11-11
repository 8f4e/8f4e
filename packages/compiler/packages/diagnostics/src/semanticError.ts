/**
 * Compiler (semantic) errors — raised after syntax is already valid.
 *
 * Use this module for errors that require semantic analysis or compiler state:
 *  - undeclared or duplicate identifiers
 *  - type mismatches
 *  - invalid instruction in the current scope
 *  - stack mismatches or overflows
 *  - function memory declarations or memory IO without the required directive
 *  - constant resolution failures
 *  - any error that cannot be detected from token/argument shape alone
 *
 * Boundary rule:
 *  If detecting the error requires symbol resolution, scope validation, stack
 *  state, type checking, or runtime-model knowledge → it belongs here.
 *  If the error can be detected from the raw token or argument structure alone,
 *  before any semantic context is built → use SyntaxIssue in syntaxError.ts.
 */

import type { CompilerDiagnosticLine, ProjectGroupPath, ProjectModuleId, StackItem } from '@8f4e/language-spec';
import {
	ErrorCode,
	type ErrorCodeValue,
	MAX_FUNCTION_PARAMETERS,
	MAX_FUNCTION_RETURN_VALUES,
	SUPPORTED_MEMORY_ACCESS_BYTE_WIDTHS,
} from '@8f4e/language-spec';
import { CompilerError } from './compilerError';

export { ErrorCode };

interface ErrorDetails {
	identifier?: string;
	inferredCallSignature?: string;
	availableOverloadSignatures?: string[];
	reason?: string;
	projectGroupPath?: ProjectGroupPath;
	projectMemoryExposureName?: string;
	targetModuleId?: ProjectModuleId;
	targetMemoryId?: string;
}

/** Only the diagnostic facts consumed by semantic error construction. */
export interface SemanticErrorOptions {
	symbol?: string;
	stack?: readonly Pick<StackItem, 'kind' | 'valueType'>[];
	details?: ErrorDetails;
}

function getProjectMemoryExposureTargetMessage(details: ErrorDetails = {}): string {
	const code = ErrorCode.INVALID_PROJECT_MEMORY_EXPOSURE_TARGET;
	const publicReference =
		details.projectGroupPath && details.projectMemoryExposureName
			? ` "${details.projectGroupPath}:${details.projectMemoryExposureName}"`
			: '';
	const targetReference =
		details.targetModuleId && details.targetMemoryId ? ` "${details.targetModuleId}:${details.targetMemoryId}"` : '';
	return `Project memory exposure${publicReference} targets undeclared memory${targetReference}. (${code})`;
}

/** Formats semantic wording from the source row, optional details, and current stack facts. */
function formatSemanticMessage(
	code: ErrorCodeValue,
	lineNumber: number,
	details: ErrorDetails | undefined,
	stack: readonly Pick<StackItem, 'kind' | 'valueType'>[]
): string {
	switch (code) {
		case ErrorCode.UNDEFINED_TEMPLATE:
			return `Template "${details?.identifier}" is not defined in the directly containing scope. (${code})`;
		case ErrorCode.DUPLICATE_TEMPLATE:
			return `Template "${details?.identifier}" is already defined in this scope. (${code})`;
		case ErrorCode.RECURSIVE_TEMPLATE:
			return `Template "${details?.identifier}" cannot recursively reference itself across an isolated group scope. (${code})`;
		case ErrorCode.INSTRUCTION_INVALID_OUTSIDE_BLOCK:
			return 'This instruction can only be used within a block or a module. (' + code + ')';
		case ErrorCode.INSTRUCTION_INVALID_OUTSIDE_LOOP:
			return 'This instruction can only be used within a loop. (' + code + ')';
		case ErrorCode.INSUFFICIENT_OPERANDS:
			return 'Insufficient number of elements in the stack for the operation to proceed. (' + code + ')';
		case ErrorCode.UNMATCHING_OPERANDS:
			return 'This instruction can only operate on operands of the same type. (' + code + ')';
		case ErrorCode.ONLY_INTEGERS:
			return 'The operation only accepts integer values as operands. (' + code + ')';
		case ErrorCode.ONLY_FLOATS:
			return 'The operation only accepts float values as operands. (' + code + ')';
		case ErrorCode.MISSING_ARGUMENT:
			return 'Missing argument. (' + code + ')';
		case ErrorCode.UNDECLARED_IDENTIFIER:
			return 'Undeclared identifier' + (details?.identifier ? `: ${details.identifier}` : '') + '. (' + code + ')';
		case ErrorCode.REFERENCE_SLOT_HAS_NO_STORAGE:
			return `Fixed reference slot${details?.identifier ? ` "${details.identifier}"` : ''} has no addressable storage. Push the slot name to use its target address. (${code})`;
		case ErrorCode.REFERENCE_SLOT_CANNOT_BE_REBOUND:
			return `Fixed reference slot${details?.identifier ? ` "${details.identifier}"` : ''} cannot be rebound. (${code})`;
		case ErrorCode.INVALID_PROJECT_MEMORY_EXPOSURE_TARGET:
			return getProjectMemoryExposureTargetMessage(details);
		case ErrorCode.GROUP_MEMORY_INITIALIZER_OUTSIDE_GROUP:
			return `init can only be used at group level. (${code})`;
		case ErrorCode.INVALID_GROUP_MEMORY_INITIALIZER_TARGET:
			return `Initialization target must be exposed scalar memory${details?.identifier ? `: ${details.identifier}` : ''}. (${code})`;
		case ErrorCode.DUPLICATE_GROUP_MEMORY_INITIALIZER:
			return `Multiple initializers target the same memory item${details?.identifier ? `: ${details.identifier}` : ''}. (${code})`;
		case ErrorCode.CONSTANT_RESOLUTION_FAILED:
			return (details?.reason ?? 'Unable to resolve constant') + '. (' + code + ')';
		case ErrorCode.EXPECTED_IDENTIFIER:
			return 'Expected identifier, got a value. (' + code + ')';
		case ErrorCode.EXPECTED_VALUE:
			return 'Expected value, got an identifier. (' + code + ')';
		case ErrorCode.ADDRESS_RANGE_REQUIRED:
			return 'This instruction requires address range metadata. (' + code + ')';
		case ErrorCode.INVALID_ACCESS_WIDTH:
			return `Access width must be ${SUPPORTED_MEMORY_ACCESS_BYTE_WIDTHS.join(', ')} bytes. (${code})`;
		case ErrorCode.ADDRESS_RANGE_TOO_SMALL:
			return 'Access width is larger than the address range. (' + code + ')';
		case ErrorCode.MISSING_MODULE_ID:
			return 'Missing module ID. (' + code + ')';
		case ErrorCode.STACK_EXPECTED_ZERO_ELEMENTS: {
			return (
				lineNumber +
				': Expected 0 elements on the stack, found ' +
				stack.length +
				' [' +
				stack.map(item => (item.kind === 'address' ? 'address' : item.valueType)).join(', ') +
				'] (' +
				code +
				')'
			);
		}
		case ErrorCode.DIVISION_BY_ZERO:
			return 'Possible division by zero. (' + code + ')';
		case ErrorCode.MISSING_FUNCTION_ID:
			return 'Missing function ID. (' + code + ')';
		case ErrorCode.MISSING_PROTOTYPE_ID:
			return 'Missing prototype ID. (' + code + ')';
		case ErrorCode.PARAM_SHAPE_UNSUPPORTED_POINTER_DEPTH:
			return (
				'paramShape cannot expand this prototype declaration because the resulting pointer parameter type is unsupported. (' +
				code +
				')'
			);
		case ErrorCode.PUSH_SHAPE_REQUIRES_MODULE_SHAPE:
			return 'pushShape requires the current module to declare the requested shape. (' + code + ')';
		case ErrorCode.INVALID_FUNCTION_SIGNATURE:
			return 'Invalid function signature. Parameters and returns must be "int", "float", or "float64". (' + code + ')';
		case ErrorCode.DUPLICATE_FUNCTION_SIGNATURE:
			return (
				'Duplicate function overload signature' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Function overloads must have unique parameter signatures. (' +
				code +
				')'
			);
		case ErrorCode.INVALID_FUNCTION_OVERLOAD_SET:
			return (
				'Invalid function overload set' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Function overloads must have the same positive parameter count; zero-parameter functions cannot be overloaded. (' +
				code +
				')'
			);
		case ErrorCode.FUNCTION_OVERLOAD_NO_MATCH: {
			const inferredCallSignature = details?.inferredCallSignature
				? `\nInferred call: ${details.inferredCallSignature}`
				: '';
			const availableOverloadSignatures =
				details?.availableOverloadSignatures && details.availableOverloadSignatures.length > 0
					? `\nAvailable overloads:\n${details.availableOverloadSignatures.map(signature => `- ${signature}`).join('\n')}`
					: '';
			return (
				'No matching function overload' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Calls must exactly match one parameter signature. (' +
				code +
				')' +
				inferredCallSignature +
				availableOverloadSignatures
			);
		}
		case ErrorCode.OVERLOADED_FUNCTION_EXPORT_UNSUPPORTED:
			return (
				'Overloaded functions cannot be exported yet' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Use a uniquely named wrapper function if this overload needs to be exported. (' +
				code +
				')'
			);
		case ErrorCode.FUNCTION_SIGNATURE_OVERFLOW:
			return (
				'Function signature overflow. Maximum ' +
				MAX_FUNCTION_PARAMETERS +
				' parameters and ' +
				MAX_FUNCTION_RETURN_VALUES +
				' return values. (' +
				code +
				')'
			);
		case ErrorCode.STACK_MISMATCH_FUNCTION_RETURN:
			return 'Stack elements do not match function return signature. (' + code + ')';
		case ErrorCode.TYPE_MISMATCH:
			return 'Type mismatch. (' + code + ')';
		case ErrorCode.MEMORY_ACCESS_IN_PURE_FUNCTION:
			return 'Memory declarations are not allowed in functions. (' + code + ')';
		case ErrorCode.IMPURE_DIRECTIVE_REQUIRED_FOR_MEMORY_IO:
			return 'Memory IO in functions requires #impure. (' + code + ')';
		case ErrorCode.UNDEFINED_FUNCTION:
			return 'Undefined function. (' + code + ')';
		case ErrorCode.DUPLICATE_PARAMETER_NAME:
			return 'Duplicate parameter name. Each parameter must have a unique name. (' + code + ')';
		case ErrorCode.COMPILER_DIRECTIVE_INVALID_CONTEXT:
			return 'This compiler directive can only be used within a module block. (' + code + ')';
		case ErrorCode.IMPURE_DIRECTIVE_INVALID_CONTEXT:
			return '#impure can only be used within a function block. (' + code + ')';
		case ErrorCode.EXPORT_DIRECTIVE_INVALID_CONTEXT:
			return '#export can only be used within a function block. (' + code + ')';
		case ErrorCode.IMPORT_DIRECTIVE_INVALID_CONTEXT:
			return '#import can only be used within a function block. (' + code + ')';
		case ErrorCode.MIXED_FLOAT_WIDTH:
			return 'Mixed float widths: floating-point values must have the same width (float32 or float64). (' + code + ')';
		case ErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK:
			return 'This instruction is not allowed inside this block type. (' + code + ')';
		case ErrorCode.SPLIT_HEX_TOO_MANY_BYTES:
			return 'Too many split-byte values for this declaration type. (' + code + ')';
		case ErrorCode.SPLIT_HEX_MIXED_TOKENS:
			return (
				'Split-byte default values must consist entirely of byte-resolving tokens: integer literals (0–255), or literal-only * or / expressions that fold to an integer in that range. Memory references and non-byte-resolving forms are not allowed in split-byte sequences. (' +
				code +
				')'
			);
		case ErrorCode.CONSTANT_NAME_AS_MEMORY_IDENTIFIER:
			return (
				'Constant-style identifiers (all-uppercase) are reserved for constants and cannot be used as memory allocation names. (' +
				code +
				')'
			);
		case ErrorCode.RESERVED_MEMORY_IDENTIFIER:
			return (
				'Reserved identifier cannot be used as a memory allocation name' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. (' +
				code +
				')'
			);
		case ErrorCode.POINTEE_WORD_SIZE_ON_NON_POINTER:
			return (
				'%*name can only be used with pointer-typed memory identifiers. ' +
				(details?.identifier ? `"${details.identifier}" is not a pointer. ` : '') +
				'(' +
				code +
				')'
			);
		case ErrorCode.POINTEE_ELEMENT_MAX_ON_NON_POINTER:
			return (
				'^*name can only be used with pointer-typed memory identifiers. ' +
				(details?.identifier ? `"${details.identifier}" is not a pointer. ` : '') +
				'(' +
				code +
				')'
			);
		case ErrorCode.RETURN_OUTSIDE_FUNCTION:
			return 'earlyReturn can only be used inside a function, not in a module. (' + code + ')';
		case ErrorCode.EXIT_IF_TRUE_OUTSIDE_MODULE:
			return 'exitIfTrue can only be used inside a module, not in a function. (' + code + ')';
		case ErrorCode.LOCAL_NAME_COLLISION_WITH_MEMORY:
			return (
				'Local variable name collides with a memory declaration' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Local names must be unique within the namespace. (' +
				code +
				')'
			);
		case ErrorCode.DUPLICATE_IDENTIFIER:
			return 'Duplicate identifier' + (details?.identifier ? `: ${details.identifier}` : '') + '. (' + code + ')';
		case ErrorCode.DUPLICATE_EXPORT_NAME:
			return (
				'Duplicate function export name' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Exported function names must be unique and must not reuse built-in export names. (' +
				code +
				')'
			);
		case ErrorCode.POINTER_DEREFERENCE_DEPTH_EXCEEDED:
			return (
				'Pointer dereference depth exceeds the declared pointer depth' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. (' +
				code +
				')'
			);
		case ErrorCode.POINTEE_ELEMENT_COUNT_UNKNOWN:
			return (
				'Pointee element count is unknown' +
				(details?.identifier ? `: ${details.identifier}` : '') +
				'. Pass the length explicitly or use count() on a named memory declaration. (' +
				code +
				')'
			);
		case ErrorCode.INVALID_ARRAY_SIZE:
			return 'Array size must be a finite nonnegative integer. (' + code + ')';
		case ErrorCode.INVALID_ADDRESS_ARITHMETIC:
			return (
				'Invalid address arithmetic. Add accepts one address and one integer offset; subtraction accepts an address minus an integer offset or two addresses. (' +
				code +
				')'
			);
		case ErrorCode.ARRAY_INITIALIZER_TOO_LONG:
			return 'Array initializer contains more values than the declared element count. (' + code + ')';
		case ErrorCode.UNKNOWN_ERROR:
		default:
			return 'Unknown error (' + code + ')';
	}
}

/** Creates a semantic source error. The caller must supply the owning source. */
export function getError(
	code: ErrorCodeValue,
	line: CompilerDiagnosticLine,
	{ symbol, stack = [], details }: SemanticErrorOptions = {}
): CompilerError {
	return new CompilerError({
		kind: 'source',
		domain: 'semantic',
		code,
		message: formatSemanticMessage(code, line.lineNumber, details, stack),
		location: { ...line.diagnosticSource, lineNumber: line.lineNumber },
		...(line.instruction !== undefined ? { instruction: line.instruction } : {}),
		...(symbol !== undefined ? { symbol } : {}),
	});
}
