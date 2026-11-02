import type { PlannedMemoryDeclaration, PointeeBaseType } from './memory';

/** Declared element types for fixed references, independent of memory layout. */
export const referenceSlotBaseTypes = {
	'int&': 'int',
	'int8&': 'int8',
	'int8u&': 'int8u',
	'int16&': 'int16',
	'int16u&': 'int16u',
	'float&': 'float',
	'float64&': 'float64',
} as const satisfies Record<string, PointeeBaseType>;

export type ReferenceSlotInstruction = keyof typeof referenceSlotBaseTypes;

/** Fixed reference instructions reserve no storage and resolve after allocation. */
export const referenceSlotInstructions = Object.keys(referenceSlotBaseTypes) as ReferenceSlotInstruction[];

const referenceSlotInstructionSet: ReadonlySet<string> = new Set(referenceSlotInstructions);

export function isReferenceSlotInstruction(instruction: string): instruction is ReferenceSlotInstruction {
	return referenceSlotInstructionSet.has(instruction);
}

/** Source identity and typed target retained for compilation and editor connections. */
export interface ResolvedReferenceSlot {
	id: string;
	type: ReferenceSlotInstruction;
	lineNumber: number;
	targetModuleId: string;
	targetMemory: PlannedMemoryDeclaration;
}

export type ReferenceSlotMap = Readonly<Record<string, ResolvedReferenceSlot>>;

/** Shared immutable namespace for contexts without fixed reference declarations. */
export const EMPTY_REFERENCE_SLOTS: ReferenceSlotMap = Object.freeze(Object.create(null));
