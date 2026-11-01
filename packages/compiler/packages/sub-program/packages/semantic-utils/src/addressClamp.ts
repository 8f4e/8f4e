import type {
	CompilationContext,
	CompilerASTLine,
	MemoryAddressRange,
	StackAddress,
	StackItem,
} from '@8f4e/language-spec';
import { ArgumentType, WORD_MEMORY_ACCESS_WIDTH } from '@8f4e/language-spec';

const DEFAULT_ACCESS_BYTE_WIDTH = WORD_MEMORY_ACCESS_WIDTH;

/**
 * Resolves the byte width protected by a clamp instruction, defaulting to one word.
 *
 * @param line - AST line being processed.
 * @returns The resolved numeric value.
 */
export function getClampAccessByteWidth(line: CompilerASTLine): number {
	const argument = line.arguments[0];
	return argument?.type === ArgumentType.LITERAL ? argument.value : DEFAULT_ACCESS_BYTE_WIDTH;
}

/**
 * Builds the safe address range for the current module memory allocation.
 *
 * @param context - Compilation context used by the operation.
 * @returns The resolved memory address range.
 */
export function getModuleAddressRange(context: Pick<CompilationContext, 'currentPlannedModule'>): MemoryAddressRange {
	const plannedModule = context.currentPlannedModule!;
	return {
		source: 'module-start',
		byteAddress: plannedModule.byteAddress,
		safeByteLength: plannedModule.allocatedByteLength,
		moduleId: plannedModule.id,
	};
}

function clampKnownIntegerValue(value: number | undefined, lower: number, upper: number): number | undefined {
	return value === undefined ? undefined : Math.min(Math.max(value, lower), upper);
}

/**
 * Converts a stack operand into the address item produced after applying an optional clamp range.
 *
 * @param operand - Stack item to convert or clamp.
 * @param range - Optional safe memory range to preserve on the produced address.
 * @param accessByteWidth - Byte width of the memory access being protected.
 * @returns The relevant stack items for the analysis step.
 */
export function getClampedAddressStackItem(
	operand: StackItem,
	range: MemoryAddressRange | undefined,
	accessByteWidth: number
): StackAddress {
	const safeAccessByteWidth = Math.min(accessByteWidth, range?.safeByteLength ?? accessByteWidth);
	const knownValue = range
		? clampKnownIntegerValue(
				operand.knownValue,
				range.byteAddress,
				range.byteAddress + Math.max(0, range.safeByteLength - accessByteWidth)
			)
		: undefined;

	return {
		kind: 'address',
		valueType: 'int',
		isNonZero: knownValue !== undefined ? knownValue !== 0 : false,
		...(knownValue !== undefined ? { knownValue } : {}),
		...(operand.kind === 'address' && operand.pointsTo ? { pointsTo: { ...operand.pointsTo } } : {}),
		address: {
			...(range ? { clampRange: range } : {}),
			...(safeAccessByteWidth > 0 ? { safeAccessByteWidth } : {}),
		},
	};
}
