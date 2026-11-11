import type { Argument, SourceArgumentShapeRule, SourceArgumentsSpec } from '@8f4e/language-spec';
import {
	ArgumentType,
	FUNCTION_TYPE_IDENTIFIERS,
	getInstructionSpec,
	isArrayMemoryDeclarationInstructionName,
	isBlockResultTypeIdentifier,
	isMemoryDeclarationInstructionName,
	isReferenceSlotInstruction,
	isSubProgramInstructionName,
	isValidModuleName,
	MODULE_NAME_PATTERN,
	SCALAR_TYPE_IDENTIFIERS,
} from '@8f4e/language-spec';
import isConstantName from './isConstantName';
import { SyntaxErrorCode, SyntaxIssue } from './syntaxError';

const supportedScalarTypeIdentifiers: ReadonlySet<string> = new Set(SCALAR_TYPE_IDENTIFIERS);
const supportedFunctionTypeIdentifiers: ReadonlySet<string> = new Set(FUNCTION_TYPE_IDENTIFIERS);

function getInstructionArgumentSpec(instruction: string): SourceArgumentsSpec | undefined {
	if (isArrayMemoryDeclarationInstructionName(instruction)) {
		return {
			minArguments: 2,
			argumentTypes: ['identifier', 'compileTimeValue'],
		};
	}

	if (isMemoryDeclarationInstructionName(instruction)) {
		return undefined;
	}

	return getInstructionSpec(instruction)?.sourceArguments;
}

function isCompileTimeValue(argument: Argument): boolean {
	return (
		argument.type === ArgumentType.LITERAL ||
		argument.type === ArgumentType.IDENTIFIER ||
		argument.type === ArgumentType.COMPILE_TIME_EXPRESSION
	);
}

function validateArgumentShape(argument: Argument, rule: SourceArgumentShapeRule, instruction: string): void {
	const invalid = (message: string) => {
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_ARGUMENT, message);
	};

	switch (rule) {
		case 'identifier':
			if (argument.type !== ArgumentType.IDENTIFIER) {
				invalid(`Invalid argument for ${instruction}: expected identifier.`);
			}
			return;
		case 'moduleName':
			if (argument.type !== ArgumentType.IDENTIFIER || !isValidModuleName(argument.value)) {
				throw new SyntaxIssue(
					SyntaxErrorCode.INVALID_IDENTIFIER,
					`Invalid module name. Module names must match ${MODULE_NAME_PATTERN}.`
				);
			}
			return;
		case 'identifierOrStringLiteral':
			if (argument.type !== ArgumentType.IDENTIFIER && argument.type !== ArgumentType.STRING_LITERAL) {
				invalid(`Invalid argument for ${instruction}: expected identifier or string literal.`);
			}
			return;
		case 'constantIdentifier':
			if (argument.type !== ArgumentType.IDENTIFIER || !isConstantName(argument.value)) {
				invalid(`Invalid argument for ${instruction}: expected constant identifier.`);
			}
			return;
		case 'literal':
			if (argument.type !== ArgumentType.LITERAL) {
				invalid(`Invalid argument for ${instruction}: expected literal.`);
			}
			return;
		case 'nonNegativeIntegerLiteral':
			if (argument.type !== ArgumentType.LITERAL || !argument.isInteger || argument.value < 0) {
				invalid(`Invalid argument for ${instruction}: expected non-negative integer literal.`);
			}
			return;
		case 'nonNegativeIntegerCompileTimeValue':
			if (
				!isCompileTimeValue(argument) ||
				(argument.type === ArgumentType.LITERAL && (!argument.isInteger || argument.value < 0))
			) {
				invalid(`Invalid argument for ${instruction}: expected non-negative integer compile-time value.`);
			}
			return;
		case 'nonNegativeCompileTimeValue':
			if (!isCompileTimeValue(argument) || (argument.type === ArgumentType.LITERAL && argument.value < 0)) {
				invalid(`Invalid argument for ${instruction}: expected non-negative compile-time value.`);
			}
			return;
		case 'compileTimeValue':
			if (!isCompileTimeValue(argument)) {
				invalid(`Invalid argument for ${instruction}: expected compile-time value.`);
			}
			return;
		case 'mapValue':
			if (argument.type === ArgumentType.STRING_LITERAL) {
				if (argument.value.length !== 1) {
					invalid(`Invalid argument for ${instruction}: string literals must contain exactly one character.`);
				}
				return;
			}
			if (!isCompileTimeValue(argument)) {
				invalid(
					`Invalid argument for ${instruction}: expected literal, compile-time value, or single-character string literal.`
				);
			}
			return;
		case 'pushValue':
			if (argument.type !== ArgumentType.STRING_LITERAL && !isCompileTimeValue(argument)) {
				invalid(`Invalid argument for ${instruction}: expected push value.`);
			}
			return;
		case 'typeIdentifier':
			if (argument.type !== ArgumentType.IDENTIFIER || !supportedScalarTypeIdentifiers.has(argument.value)) {
				invalid(`Invalid argument for ${instruction}: expected type identifier (int, float, or float64).`);
			}
			return;
		case 'functionTypeIdentifier':
			if (argument.type !== ArgumentType.IDENTIFIER || !supportedFunctionTypeIdentifiers.has(argument.value)) {
				invalid(`Invalid argument for ${instruction}: expected function type identifier.`);
			}
			return;
		case 'ifResultType':
			if (argument.type !== ArgumentType.IDENTIFIER || !isBlockResultTypeIdentifier(argument.value)) {
				invalid(`Invalid argument for ${instruction}: expected result type (int or float).`);
			}
			return;
	}
}

/**
 * Validates instruction arguments.
 *
 * @param instruction - Instruction name to inspect.
 * @param args - Parsed instruction arguments to validate.
 * @returns Nothing.
 */
export default function validateInstructionArguments(instruction: string, args: Argument[]): void {
	if (!isSubProgramInstructionName(instruction)) {
		throw new SyntaxIssue(SyntaxErrorCode.UNRECOGNISED_INSTRUCTION);
	}

	const spec = getInstructionArgumentSpec(instruction);
	if (!spec) {
		return;
	}

	if (spec.minArguments !== undefined && args.length < spec.minArguments) {
		throw new SyntaxIssue(SyntaxErrorCode.MISSING_ARGUMENT, `Missing required argument for ${instruction}.`);
	}

	if (spec.maxArguments !== undefined && args.length > spec.maxArguments) {
		throw new SyntaxIssue(SyntaxErrorCode.INVALID_ARGUMENT, `Too many arguments for ${instruction}.`);
	}

	if (!spec.argumentTypes) {
		return;
	}
	if (isReferenceSlotInstruction(instruction)) {
		const [name, target] = args;
		const isMemoryStartAddress =
			target?.type === ArgumentType.IDENTIFIER &&
			(target.referenceKind === 'intermodular-module-nth-reference' ||
				((target.referenceKind === 'memory-reference' || target.referenceKind === 'intermodular-reference') &&
					!target.isEndAddress &&
					!(target.referenceKind === 'memory-reference' && target.targetMemoryId === 'this')));
		if (
			name?.type !== ArgumentType.IDENTIFIER ||
			name.referenceKind !== 'plain' ||
			name.value === 'this' ||
			!isMemoryStartAddress
		) {
			throw new SyntaxIssue(SyntaxErrorCode.INVALID_REFERENCE_SLOT);
		}
	}

	if (Array.isArray(spec.argumentTypes)) {
		for (let i = 0; i < spec.argumentTypes.length; i++) {
			const argument = args[i];
			if (!argument) {
				return;
			}
			validateArgumentShape(argument, spec.argumentTypes[i], instruction);
		}
		if (isArrayMemoryDeclarationInstructionName(instruction)) {
			const name = args[0];
			if (name.type === ArgumentType.IDENTIFIER && name.referenceKind === 'constant') {
				throw new SyntaxIssue(
					SyntaxErrorCode.INVALID_IDENTIFIER,
					`Array name "${name.value}" uses a naming pattern reserved for constants.`
				);
			}
			for (let i = spec.argumentTypes.length; i < args.length; i++) {
				validateArgumentShape(args[i], 'compileTimeValue', instruction);
			}
		}
		if (spec.restArgumentType) {
			for (let i = spec.argumentTypes.length; i < args.length; i++) {
				validateArgumentShape(args[i], spec.restArgumentType, instruction);
			}
		}
		return;
	}

	for (let i = 0; i < args.length; i++) {
		validateArgumentShape(args[i], spec.argumentTypes, instruction);
	}
}
