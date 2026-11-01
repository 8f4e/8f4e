import type { MemoryDeclarationLine } from './ast';

export const scalarMemoryDeclarationInstructions = [
	'int',
	'int*',
	'int**',
	'int8*',
	'int8**',
	'int8u*',
	'int8u**',
	'int16*',
	'int16**',
	'int16u*',
	'int16u**',
	'float',
	'float*',
	'float**',
	'float64',
	'float64*',
	'float64**',
] as const;

export type ScalarMemoryDeclarationInstruction = (typeof scalarMemoryDeclarationInstructions)[number];

export type MemoryType = ScalarMemoryDeclarationInstruction;

export const arrayMemoryDeclarationInstructions = [
	'float[]',
	'int[]',
	'int8[]',
	'int8u[]',
	'int16[]',
	'int16u[]',
	'int32[]',
	'float*[]',
	'float**[]',
	'int*[]',
	'int**[]',
	'float64[]',
	'float64*[]',
	'float64**[]',
] as const;

export type ArrayDeclarationInstruction = (typeof arrayMemoryDeclarationInstructions)[number];
export type MemoryDeclarationInstruction = ScalarMemoryDeclarationInstruction | ArrayDeclarationInstruction;

export const memoryDeclarationInstructions = [
	...scalarMemoryDeclarationInstructions,
	...arrayMemoryDeclarationInstructions,
] as readonly MemoryDeclarationInstruction[];

const scalarMemoryDeclarationInstructionSet: ReadonlySet<string> = new Set(scalarMemoryDeclarationInstructions);
const arrayMemoryDeclarationInstructionSet: ReadonlySet<string> = new Set(arrayMemoryDeclarationInstructions);
const memoryDeclarationInstructionSet: ReadonlySet<string> = new Set(memoryDeclarationInstructions);

export function isScalarMemoryDeclarationInstructionName(
	instruction: string
): instruction is ScalarMemoryDeclarationInstruction {
	return scalarMemoryDeclarationInstructionSet.has(instruction);
}

export function isArrayMemoryDeclarationInstructionName(
	instruction: string
): instruction is ArrayDeclarationInstruction {
	return arrayMemoryDeclarationInstructionSet.has(instruction);
}

export function isMemoryDeclarationInstructionName(instruction: string): instruction is MemoryDeclarationInstruction {
	return memoryDeclarationInstructionSet.has(instruction);
}

export type BaseMemoryType = 'int' | 'int8' | 'int16' | 'float' | 'float64';
type ReservedUnsignedBaseMemoryType = 'int8u' | 'int16u';
export type PointeeBaseType = BaseMemoryType | ReservedUnsignedBaseMemoryType;
type PointerSlotType = 'pointer';
type BaseTypeMetadataKey = PointeeBaseType | PointerSlotType;
export type MemoryValueKind = 'int32' | 'float32' | 'float64';

/** Numeric storage metadata for a scalar or pointer slot type. */
interface BaseTypeMetadata {
	wordSize: number;
	isInteger: boolean;
	valueKind: MemoryValueKind;
	min: number;
	max: number;
	unsignedMin?: number;
	unsignedMax?: number;
}

export const BASE_TYPE_METADATA: Record<BaseTypeMetadataKey, BaseTypeMetadata> = {
	int8: {
		wordSize: 1,
		isInteger: true,
		valueKind: 'int32',
		min: -128,
		max: 127,
	},
	int8u: {
		wordSize: 1,
		isInteger: true,
		valueKind: 'int32',
		min: 0,
		max: 255,
	},
	int16: {
		wordSize: 2,
		isInteger: true,
		valueKind: 'int32',
		min: -32768,
		max: 32767,
	},
	int16u: {
		wordSize: 2,
		isInteger: true,
		valueKind: 'int32',
		min: 0,
		max: 65535,
	},
	int: {
		wordSize: 4,
		isInteger: true,
		valueKind: 'int32',
		min: -2147483648,
		max: 2147483647,
		unsignedMin: 0,
		unsignedMax: 4294967295,
	},
	float: {
		wordSize: 4,
		isInteger: false,
		valueKind: 'float32',
		min: -3.4028234663852886e38,
		max: 3.4028234663852886e38,
	},
	float64: {
		wordSize: 8,
		isInteger: false,
		valueKind: 'float64',
		min: -1.7976931348623157e308,
		max: 1.7976931348623157e308,
	},
	pointer: {
		wordSize: 4,
		isInteger: true,
		valueKind: 'int32',
		min: -2147483648,
		max: 2147483647,
	},
};

/** Memory declaration metadata produced by layout planning before semantic defaults are applied. */
export interface PlannedMemoryDeclaration {
	numberOfElements: number;
	/** Byte width of one typed element, independent of the 4-byte allocation grid. */
	elementWordSize: number;
	type: MemoryType;
	byteAddress: number;
	/** Actual value bytes covered by declared elements, excluding alignment padding. */
	elementByteLength: number;
	/** Reserved 4-byte allocation units, including any leading alignment padding. */
	allocationUnitCount: number;
	/** Storage byte length from `byteAddress`, excluding leading alignment padding. */
	allocatedByteLength: number;
	/** Absolute address of the first element in 4-byte allocation units. */
	allocationUnitAddress: number;
	/** Last aligned byte address occupied by this declaration. */
	endByteAddress: number;
	/** Safe byte length when addressing this declaration through its end address. */
	endAddressSafeByteLength: number;
	lineNumber: number;
	isInteger: boolean;
	isFloat64?: boolean;
	/**
	 * The base type of the pointee. Set only for pointer types (i.e. when `pointeeBaseType !== undefined` the variable holds an address).
	 * Determines load width and value range for dereference operations.
	 * - `'int'` / `'float'` / `'float64'`: standard 32-bit int, 32-bit float, or 64-bit float pointee
	 * - `'int8'` / `'int16'`: narrow signed integer pointee (1 or 2 bytes)
	 * - `'int8u'` / `'int16u'`: narrow unsigned integer pointee
	 */
	pointeeBaseType?: PointeeBaseType;
	id: string;
	/** Number of pointer layers in the declaration. Non-pointers have depth 0. */
	pointerDepth: number;
	isUnsigned: boolean;
}

export interface PlannedMemoryDeclarationSource {
	line: MemoryDeclarationLine;
	isInherited: boolean;
}

export interface PlannedMemoryModule {
	id: string;
	lineNumber: number;
	byteAddress: number;
	/** Reserved 4-byte allocation units, including declaration alignment padding. */
	allocationUnitCount: number;
	/** Reserved byte length, equal to `allocationUnitCount * ALLOCATION_UNIT_BYTE_SIZE`. */
	allocatedByteLength: number;
	/** Last aligned byte address occupied by this module. */
	endByteAddress: number;
	/** Safe byte length when addressing this module through its end address. */
	endAddressSafeByteLength: number;
	/** Declaration lookup by id, materialized by the planner from the ordered declarations below. */
	memory: Record<string, PlannedMemoryDeclaration>;
	/** Declarations in planned/source order; entries are the same objects exposed through `memory`. */
	declarations: readonly PlannedMemoryDeclaration[];
	declarationSources: readonly PlannedMemoryDeclarationSource[];
}

export interface MemoryLayoutPlan {
	/** Module lookup by id, materialized by the planner from the ordered module list below. */
	modules: Record<string, PlannedMemoryModule>;
	/** Modules in alphabetical layout order by id; entries are the same objects exposed through `modules`. */
	moduleList: readonly PlannedMemoryModule[];
}

export type MemoryDefaultValue = number | Record<string, number>;

export interface MemoryDefault {
	value: MemoryDefaultValue;
	hasExplicitDefault?: boolean;
	isInherited: boolean;
}

export type MemoryDefaults = Record<string, MemoryDefault>;

export interface MemoryPointerMetadata {
	/** Element count of the known pointee memory item, when initialized from a tracked memory address. */
	pointeeElementCount?: number;
}

export type MemoryPointerMetadataMap = Record<string, MemoryPointerMetadata>;

export type ResolvedMemoryDeclaration = PlannedMemoryDeclaration & MemoryPointerMetadata;

export type MemoryBuffer = Int32Array;

export type MemoryValueChange = {
	allocationUnitCount: number;
	allocationUnitAddress: number;
	value: number | Record<string, number>;
	isInteger: boolean;
	isFloat64?: boolean;
	elementWordSize: number;
};
