import type { InstructionSpec, instructionSpecs, MemoryOperationEffectSpec } from './instructionSpecs';
import type { MemoryDeclarationInstruction } from './memory';

/** Names of every instruction entry registered in the language spec table. */
export type InstructionSpecName = keyof typeof instructionSpecs;

/** Instruction spec names that should be dispatched to code generation. */
export type CodegenInstructionSpecName = {
	[TInstruction in InstructionSpecName]: (typeof instructionSpecs)[TInstruction] extends { codegen: false }
		? never
		: TInstruction;
}[InstructionSpecName];

/** Instruction spec names that exist only for parsing or semantic passes. */
export type NonCodegenInstructionSpecName = Exclude<InstructionSpecName, CodegenInstructionSpecName>;

/** Instruction names that may appear as source instructions after tokenization. */
export type SourceInstructionSpecName = {
	[TInstruction in InstructionSpecName]: (typeof instructionSpecs)[TInstruction] extends { sourceInstruction: false }
		? never
		: TInstruction;
}[InstructionSpecName];

/** Codegen instruction names whose specs reject all source arguments. */
export type NoSourceArgumentInstructionName = {
	[TInstruction in CodegenInstructionSpecName]: (typeof instructionSpecs)[TInstruction] extends {
		sourceArguments: { maxArguments: 0 };
	}
		? TInstruction
		: never;
}[CodegenInstructionSpecName];

/** Binary instructions that accept an optional push-style source operand. */
export type InlineOperandInstructionName = {
	[TInstruction in InstructionSpecName]: (typeof instructionSpecs)[TInstruction] extends { inlineOperand: true }
		? TInstruction
		: never;
}[InstructionSpecName];

/** Extracts memory-effect metadata from an instruction spec when present. */
type MemoryOperationForSpec<TSpec> = TSpec extends { effects: { memory: infer TMemory } } ? TMemory : never;

/** Instruction names whose memory-effect metadata matches the requested operation shape. */
export type InstructionNamesByMemoryOperation<TOperation extends MemoryOperationEffectSpec> = {
	[TInstruction in InstructionSpecName]: [MemoryOperationForSpec<(typeof instructionSpecs)[TInstruction]>] extends [
		never,
	]
		? never
		: MemoryOperationForSpec<(typeof instructionSpecs)[TInstruction]> extends TOperation
			? TInstruction
			: never;
}[InstructionSpecName];

/** Integer-producing load instruction names. */
export type LoadInstructionSpecName = InstructionNamesByMemoryOperation<
	Extract<MemoryOperationEffectSpec, { kind: 'load' }> & { resultType: 'int' }
>;

/** Float-producing load instruction names. */
export type FloatLoadInstructionSpecName = InstructionNamesByMemoryOperation<
	Extract<MemoryOperationEffectSpec, { kind: 'load' }> & { resultType: 'float' }
>;

/** Lookup result type for known instructions, memory declarations, and loose parser strings. */
export type InstructionSpecLookup<TInstruction extends string> = TInstruction extends InstructionSpecName
	? (typeof instructionSpecs)[TInstruction]
	: TInstruction extends MemoryDeclarationInstruction
		? (typeof instructionSpecs)['memoryDeclaration']
		: InstructionSpec | undefined;
