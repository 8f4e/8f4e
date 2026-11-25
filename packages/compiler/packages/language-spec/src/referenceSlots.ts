import type { PlannedMemoryDeclaration, PointeeBaseType } from './memory';

/** Declared element types for fixed references, independent of memory layout. */
export const referenceSlotTargetTypes = {
	'int&': { baseType: 'int', pointerDepth: 0 },
	'int8&': { baseType: 'int8', pointerDepth: 0 },
	'int8u&': { baseType: 'int8u', pointerDepth: 0 },
	'int16&': { baseType: 'int16', pointerDepth: 0 },
	'int16u&': { baseType: 'int16u', pointerDepth: 0 },
	'float&': { baseType: 'float', pointerDepth: 0 },
	'float64&': { baseType: 'float64', pointerDepth: 0 },
	'int*&': { baseType: 'int', pointerDepth: 1 },
	'int16*&': { baseType: 'int16', pointerDepth: 1 },
	'float*&': { baseType: 'float', pointerDepth: 1 },
} as const satisfies Record<string, { baseType: PointeeBaseType; pointerDepth: 0 | 1 }>;

export type ReferenceSlotInstruction = keyof typeof referenceSlotTargetTypes;

/** Fixed reference instructions reserve no storage and resolve after allocation. */
export const referenceSlotInstructions = Object.keys(referenceSlotTargetTypes) as ReferenceSlotInstruction[];

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
