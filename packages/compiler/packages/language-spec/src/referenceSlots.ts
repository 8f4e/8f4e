import type { PlannedMemoryDeclaration } from './memory';

/** Fixed, typed references resolved after allocation; these declarations reserve no storage. */
export const referenceSlotInstructions = [
	'int&',
	'int8&',
	'int8u&',
	'int16&',
	'int16u&',
	'float&',
	'float64&',
] as const;

export type ReferenceSlotInstruction = (typeof referenceSlotInstructions)[number];

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
