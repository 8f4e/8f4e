import { CompilerError, getError, syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import type {
	ArrayMemoryDeclarationLine,
	CompilerASTLine,
	ErrorCodeValue,
	MemoryDeclarationLine,
	MemoryDefault,
	MemoryDefaults,
	MemoryLayoutPlan,
	MemoryReferenceResolutionLineFacts,
	MemoryReferenceResolutionReport,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
	PointeeBaseType,
	ScalarMemoryDeclarationLine,
} from '@8f4e/language-spec';
import { ArgumentType, BASE_TYPE_METADATA, ErrorCode, isArrayMemoryDeclarationLine } from '@8f4e/language-spec';
import { type MemoryArgumentShape, parseMemoryInstructionArgumentsShape, type SplitByteToken } from '@8f4e/tokenizer';

export interface ResolveMemoryDefaultsInput {
	memoryPlan: MemoryLayoutPlan;
	memoryReferences: Pick<MemoryReferenceResolutionReport, 'declarationSourcesByModuleId'>;
}

interface MemoryDefaultResolverErrorDetails {
	identifier?: string;
	reason?: string;
}

interface ScalarDefaultResolution {
	defaultValue: number;
}

const MAX_SPLIT_BYTE_WIDTH = 4;

function resolverError(
	compilerErrorCode: ErrorCodeValue,
	line: CompilerASTLine,
	message: string,
	details?: MemoryDefaultResolverErrorDetails
) {
	const error = getError(compilerErrorCode, line, { details: details });
	return new CompilerError({ ...error.diagnostic, message });
}

function combineSplitHexBytes(bytes: readonly number[], maxBytes: number): number {
	let result = 0;
	for (const byte of bytes) {
		result = result * 256 + byte;
	}
	for (let index = bytes.length; index < maxBytes; index++) {
		result *= 256;
	}
	return result;
}

function resolveSplitByteTokens(tokens: readonly SplitByteToken[], line: CompilerASTLine): number {
	if (tokens.length > MAX_SPLIT_BYTE_WIDTH) {
		throw resolverError(ErrorCode.SPLIT_HEX_TOO_MANY_BYTES, line, 'Split hex default has too many bytes.');
	}

	const bytes = tokens.map(token => {
		if (token.type === 'literal') {
			return token.value;
		}

		throw resolverError(
			ErrorCode.CONSTANT_NAME_AS_MEMORY_IDENTIFIER,
			line,
			'Constant names cannot be used as memory default split-byte tokens.'
		);
	});

	return combineSplitHexBytes(bytes, MAX_SPLIT_BYTE_WIDTH);
}

function parseScalarDeclarationShape(
	line: ScalarMemoryDeclarationLine
): import('@8f4e/tokenizer').ParsedMemoryInstructionArguments {
	const result = parseMemoryInstructionArgumentsShape(line.arguments);
	if (!result.ok) throw syntaxErrorAt(result.issue.code, result.issue.message, line.diagnosticSource, line);
	return result.value;
}

function assertDeclarableScalarIdentifier(shape: MemoryArgumentShape, line: ScalarMemoryDeclarationLine): void {
	switch (shape.type) {
		case 'literal':
		case 'split-byte-tokens':
			return;
		case 'constant-identifier':
			throw resolverError(
				ErrorCode.CONSTANT_NAME_AS_MEMORY_IDENTIFIER,
				line,
				'Constant names cannot be used as memory identifiers.',
				{ identifier: shape.value }
			);
		case 'identifier':
			if (shape.value === 'this') {
				throw resolverError(ErrorCode.RESERVED_MEMORY_IDENTIFIER, line, 'Reserved memory identifier.', {
					identifier: shape.value,
				});
			}
			return;
		default:
			throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Invalid memory identifier.', { identifier: '' });
	}
}

function getMemoryDeclarationOrThrow(
	module: PlannedMemoryModule,
	memoryId: string,
	line: CompilerASTLine
): PlannedMemoryDeclaration {
	const declaration = module.memory[memoryId];
	if (!declaration) {
		throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unknown memory declaration.', { identifier: memoryId });
	}
	return declaration;
}

function getIntermoduleMemoryDeclaration(
	shape: Extract<
		MemoryArgumentShape,
		{
			type:
				| 'intermodular-element-count'
				| 'intermodular-element-word-size'
				| 'intermodular-element-max'
				| 'intermodular-element-min';
		}
	>,
	line: ScalarMemoryDeclarationLine,
	memoryPlan: MemoryLayoutPlan
): PlannedMemoryDeclaration {
	const targetModule = memoryPlan.modules[shape.module];
	if (!targetModule) {
		throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unknown module in memory default.', {
			identifier: shape.module,
		});
	}

	const targetMemory = targetModule.memory[shape.memory];
	if (!targetMemory) {
		throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unknown memory declaration in memory default.', {
			identifier: shape.memory,
		});
	}

	return targetMemory;
}

function getElementMetadataKey(declaration: PlannedMemoryDeclaration): PointeeBaseType | 'pointer' {
	return declaration.pointerDepth > 0 ? 'pointer' : (declaration.type as PointeeBaseType);
}

function resolveMemoryDefaultValue(
	shape: MemoryArgumentShape,
	line: ScalarMemoryDeclarationLine,
	module: PlannedMemoryModule,
	memoryPlan: MemoryLayoutPlan
): number {
	switch (shape.type) {
		case 'literal':
			return shape.value;
		case 'memory-reference': {
			if (shape.base === 'this') {
				return shape.isEndAddress ? module.endByteAddress : module.byteAddress;
			}
			const declaration = getMemoryDeclarationOrThrow(module, shape.base, line);
			return shape.isEndAddress ? declaration.endByteAddress : declaration.byteAddress;
		}
		case 'element-count':
			return getMemoryDeclarationOrThrow(module, shape.base, line).numberOfElements;
		case 'intermodular-module-reference': {
			const targetModule = memoryPlan.modules[shape.module];
			if (!targetModule) {
				throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unknown module in memory default.', {
					identifier: shape.module,
				});
			}
			return shape.isEndAddress ? targetModule.endByteAddress : targetModule.byteAddress;
		}
		case 'intermodular-element-count':
			return getIntermoduleMemoryDeclaration(shape, line, memoryPlan).numberOfElements;
		case 'intermodular-element-word-size':
			return getIntermoduleMemoryDeclaration(shape, line, memoryPlan).elementWordSize;
		case 'intermodular-element-max':
			return BASE_TYPE_METADATA[getElementMetadataKey(getIntermoduleMemoryDeclaration(shape, line, memoryPlan))].max;
		case 'intermodular-element-min':
			return BASE_TYPE_METADATA[getElementMetadataKey(getIntermoduleMemoryDeclaration(shape, line, memoryPlan))].min;
		case 'intermodular-reference':
			throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unresolved intermodule memory default value.', {
				identifier: shape.pattern,
			});
		default:
			throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unresolved memory default value.', {
				identifier: shape.type === 'identifier' || shape.type === 'constant-identifier' ? shape.value : '',
			});
	}
}

function resolveScalarDefault(
	line: ScalarMemoryDeclarationLine,
	module: PlannedMemoryModule,
	memoryPlan: MemoryLayoutPlan
): ScalarDefaultResolution {
	if (line.arguments.length === 0) {
		return {
			defaultValue: 0,
		};
	}

	const shape = parseScalarDeclarationShape(line);
	assertDeclarableScalarIdentifier(shape.firstArg, line);

	if (shape.firstArg.type === 'split-byte-tokens') {
		return {
			defaultValue: resolveSplitByteTokens(shape.firstArg.tokens, line),
		};
	}

	if (!shape.secondArg) {
		return {
			defaultValue: shape.firstArg.type === 'literal' ? shape.firstArg.value : 0,
		};
	}

	if (shape.secondArg.type === 'split-byte-tokens') {
		return {
			defaultValue: resolveSplitByteTokens(shape.secondArg.tokens, line),
		};
	}

	return {
		defaultValue: resolveMemoryDefaultValue(shape.secondArg, line, module, memoryPlan),
	};
}

function createArrayDefaultValues(line: ArrayMemoryDeclarationLine, plannedDeclaration: PlannedMemoryDeclaration) {
	const initializerArguments = line.arguments.slice(2);
	if (initializerArguments.length > plannedDeclaration.numberOfElements) {
		throw resolverError(
			ErrorCode.ARRAY_INITIALIZER_TOO_LONG,
			line,
			'Array initializer contains more values than the declared element count.'
		);
	}

	return initializerArguments.reduce<Record<string, number>>((defaults, argument, index) => {
		if (argument.type !== ArgumentType.LITERAL) {
			throw resolverError(ErrorCode.UNDECLARED_IDENTIFIER, line, 'Unresolved array initializer value.', {
				identifier: 'value' in argument ? String(argument.value) : '',
			});
		}
		defaults[index] = plannedDeclaration.isInteger ? Math.trunc(argument.value) : argument.value;
		return defaults;
	}, {});
}

function declarationHasExplicitDefault(line: MemoryDeclarationLine): boolean {
	if (isArrayMemoryDeclarationLine(line)) {
		return line.arguments.length > 2;
	}

	const firstArg = line.arguments[0];
	if (!firstArg) {
		return false;
	}

	if (firstArg.type !== ArgumentType.IDENTIFIER) {
		return true;
	}

	if (firstArg.referenceKind === 'constant') {
		return true;
	}

	return line.arguments.length > 1;
}

function setMemoryDefault(
	defaults: MemoryDefaults,
	memoryId: number,
	value: MemoryDefault['value'],
	line: MemoryDeclarationLine,
	isInherited: boolean
): void {
	defaults[memoryId] = {
		value,
		hasExplicitDefault: declarationHasExplicitDefault(line),
		isInherited,
	};
}

function applyMemoryReferenceFacts<TLine extends CompilerASTLine>(
	line: TLine,
	facts?: MemoryReferenceResolutionLineFacts
): TLine {
	return facts?.arguments ? ({ ...line, arguments: facts.arguments } as TLine) : line;
}

function resolveModuleMemoryDefaults(
	plannedModule: PlannedMemoryModule,
	memoryPlan: MemoryLayoutPlan,
	memoryReferences: ResolveMemoryDefaultsInput['memoryReferences']
): MemoryDefaults {
	const memoryDefaults: MemoryDefaults = {};
	const declarationSourceFacts = memoryReferences.declarationSourcesByModuleId[plannedModule.id]!.lineFacts;

	plannedModule.declarationSources.forEach(({ line, isInherited }, index) => {
		const plannedDeclaration = plannedModule.declarations[index]!;

		const resolvedLine = applyMemoryReferenceFacts(line, declarationSourceFacts[index]);
		if (isArrayMemoryDeclarationLine(resolvedLine)) {
			setMemoryDefault(
				memoryDefaults,
				plannedDeclaration.id,
				createArrayDefaultValues(resolvedLine, plannedDeclaration),
				resolvedLine,
				isInherited
			);
			return;
		}

		const { defaultValue } = resolveScalarDefault(resolvedLine, plannedModule, memoryPlan);
		setMemoryDefault(
			memoryDefaults,
			plannedDeclaration.id,
			plannedDeclaration.isInteger ? Math.trunc(defaultValue) : defaultValue,
			resolvedLine,
			isInherited
		);
	});

	// A repeated name uses the winning default at each allocation of that name.
	for (const declaration of plannedModule.declarations) {
		if (declaration.name === undefined) continue;
		const effective = plannedModule.memory[declaration.name]!;
		if (effective.id !== declaration.id) {
			memoryDefaults[declaration.id] = {
				...memoryDefaults[effective.id]!,
				isInherited: memoryDefaults[declaration.id]!.isInherited,
			};
		}
	}

	return memoryDefaults;
}

/**
 * Resolves memory defaults for a whole planned sub-program.
 *
 * The memory plan is the source of truth for declaration order, layout, and
 * effective declaration source lines after shape expansion.
 *
 * @param input - Completed memory plan and memory-reference facts for the sub-program.
 * @returns Memory defaults keyed by module id.
 */
export function resolveMemoryDefaults(input: ResolveMemoryDefaultsInput): Record<string, MemoryDefaults> {
	const memoryDefaultsByModuleId: Record<string, MemoryDefaults> = {};

	for (const plannedModule of input.memoryPlan.moduleList) {
		const memoryDefaults = resolveModuleMemoryDefaults(plannedModule, input.memoryPlan, input.memoryReferences);
		memoryDefaultsByModuleId[plannedModule.id] = memoryDefaults;
	}

	return memoryDefaultsByModuleId;
}
