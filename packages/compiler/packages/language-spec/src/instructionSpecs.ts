import { BYTE_MEMORY_ACCESS_WIDTH, HALF_WORD_MEMORY_ACCESS_WIDTH, WORD_MEMORY_ACCESS_WIDTH } from './constants';
import type { InstructionSpecLookup, InstructionSpecName } from './instructionSpecTypes';
import { blockClose, loadInstruction, stack, stackMutation, withDocsAndStack } from './instructionSpecUtils';
import type { MemoryDeclarationInstruction } from './memory';
import { memoryDeclarationInstructions } from './memory';
import type { BlockTypeValue, CompilationContext } from './semantic';
import { BlockType } from './semantic';

/** Operand categories that instruction specs can require from the analysis stack. */
export type OperandRule = 'int' | 'float' | 'matching' | 'sameType';

/** Source argument shapes that the tokenizer can validate before semantic resolution. */
export type SourceArgumentShapeRule =
	| 'identifier'
	| 'moduleName'
	| 'identifierOrStringLiteral'
	| 'constantIdentifier'
	| 'literal'
	| 'nonNegativeIntegerLiteral'
	| 'nonNegativeIntegerCompileTimeValue'
	| 'nonNegativeCompileTimeValue'
	| 'compileTimeValue'
	| 'mapValue'
	| 'typeIdentifier'
	| 'functionTypeIdentifier'
	| 'ifResultType'
	| 'pushValue';

/** Top-level source block kinds that own independently parsed compiler ASTs. */
export type SourceBlockPlacement = 'module' | 'function' | 'constants' | 'prototype';

/** Source block kinds that compile into executable compiler units. */
export type SourceBlockCompilationMode = 'module' | 'function' | null;

/** Nested block kinds tracked inside module and function source blocks. */
export type NestedBlockPlacement = 'loop' | 'map' | 'block' | 'if';

/** Any block kind known to tokenizer placement validation. */
export type BlockPlacement = SourceBlockPlacement | NestedBlockPlacement;

/** Declarative placement rules consumed by the tokenizer while parsing source lines. */
export type InstructionPlacement = {
	/** Allows the instruction outside any currently open source block. */
	topLevel?: boolean;
	/** Source block kinds where the instruction may appear. */
	sourceBlocks?: readonly SourceBlockPlacement[];
	/** Nested block kind that must already be open for the instruction to appear. */
	requiredNestedBlock?: NestedBlockPlacement;
	/** Nested block kinds that reject the instruction while they are open. */
	disallowedNestedBlocks?: readonly NestedBlockPlacement[];
	/** Block lifecycle metadata for instructions that open, close, or branch within blocks. */
	block?: {
		/** Block kind represented by this instruction. */
		kind: BlockPlacement;
		/** Whether this instruction starts, ends, or branches within the block. */
		role: 'start' | 'end' | 'branch';
		/** Allowed immediate parent block kinds for a block-start instruction. */
		parents?: readonly BlockPlacement[];
		/** Whether this block kind may be nested inside itself. */
		nestable?: boolean;
		/** Top-level source-block metadata for blocks that own independently parsed ASTs. */
		sourceBlock?: {
			compilesToModule: boolean;
			compilationMode: SourceBlockCompilationMode;
		};
		/** Whether this block participates in stack/control-flow block matching. */
		stackBlock?: boolean;
	};
};

/** Function declaration metadata for instructions allowed before executable body code. */
export interface FunctionDeclarationInstructionSpec {
	preBody?: boolean;
	importedFunction?: boolean;
}

/** Minimal line shape needed by the stack signature resolver for `storeBytes`. */
type StoreBytesSourceLine = { arguments: [{ value: number }] };

/** Shared source-argument spec for instructions that must not receive source arguments. */
const noSourceArguments = { maxArguments: 0 } as const satisfies SourceArgumentsSpec;

/** Placement shortcut for instructions allowed only inside modules. */
const modulePlacement = { sourceBlocks: ['module'] } as const satisfies InstructionPlacement;

/** Placement shortcut for instructions allowed only inside functions. */
const functionPlacement = { sourceBlocks: ['function'] } as const satisfies InstructionPlacement;

/** Placement shortcut for instructions shared by module and function bodies. */
const moduleOrFunctionPlacement = { sourceBlocks: ['module', 'function'] } as const satisfies InstructionPlacement;

/** Placement shortcut for constants and imports that may seed source block namespaces. */
const constantsPlacement = {
	topLevel: true,
	sourceBlocks: ['module', 'function', 'constants'],
} as const satisfies InstructionPlacement;

/** Placement shortcut for namespace imports consumed by compile-time declarations in any source block. */
const constantNamespaceImportPlacement = {
	topLevel: true,
	sourceBlocks: ['module', 'function', 'constants', 'prototype'],
} as const satisfies InstructionPlacement;

/** Placement shortcut for instructions that require an active loop block. */
const loopPlacement = { requiredNestedBlock: 'loop' } as const satisfies InstructionPlacement;

/** Placement shortcut for instructions that require an active map block. */
const mapPlacement = { requiredNestedBlock: 'map' } as const satisfies InstructionPlacement;

/** Defines where and how an instruction may be used during validation. */
export interface ValidationSpec<TLine = unknown> {
	placement?: InstructionPlacement;
	minOperands?: number;
	operandTypes?: OperandRule[] | OperandRule;
	validateOperands?: (
		line: TLine,
		context: CompilationContext
	) => {
		minOperands?: number;
		operandTypes?: OperandRule[] | OperandRule;
	};
}

/** Human-readable documentation attached to an instruction spec. */
export interface InstructionDocumentation {
	shortDescription: string;
}

/** Label language used for user-facing and machine-readable stack signatures. */
export type StackValueLabel =
	| '...'
	| 'T'
	| 'T?'
	| 'args...'
	| 'bytes...'
	| 'float'
	| 'float64'
	| 'int'
	| 'never'
	| 'ptr'
	| 'returns...';

/** Fully resolved stack signature for an instruction at a specific source line. */
export interface ResolvedStackEffect {
	inputs: readonly StackValueLabel[];
	outputs: readonly StackValueLabel[];
}

/** Describes how many analysis-stack values an instruction consumes. */
export type StackConsumeSpec =
	| number
	| 'all'
	| {
			argumentValueIndex: number;
			add: number;
	  };

/** Describes values produced on the analysis stack after an instruction runs. */
export type StackProducedItemSpec =
	| {
			kind: 'int';
			isNonZero?: boolean | 'fromInput';
			inputIndex?: number;
	  }
	| {
			kind: 'float';
			isNonZero?: boolean | 'fromInput';
			inputIndex?: number;
	  }
	| {
			kind: 'float64';
			isNonZero?: boolean | 'fromInput';
			inputIndex?: number;
	  }
	| {
			kind: 'same';
			inputIndex?: number;
			isNonZero?: boolean | 'fromInput';
	  };

/** Machine-readable description of how an instruction mutates the analysis stack. */
export interface StackMutationSpec {
	consumes: StackConsumeSpec;
	produces?: readonly StackProducedItemSpec[];
	dropped?: 'consumed';
}

/** Stack signature plus optional dynamic resolution and mutation metadata. */
export interface StackEffectSpec<TLine = unknown> extends ResolvedStackEffect {
	resolve?: (line: TLine) => ResolvedStackEffect;
	effect?: StackMutationSpec;
}

/** Semantic effect applied when an instruction closes a compiler block. */
export interface BlockCloseEffectSpec {
	blockType: BlockTypeValue;
	restoreResult?: boolean;
}

/** WebAssembly load opcode families represented by compiler memory effects. */
export type MemoryLoadVariant = 'i32' | 'i32_8s' | 'i32_8u' | 'i32_16s' | 'i32_16u' | 'f32';

/** Semantic memory operation metadata attached to memory-related instruction specs. */
export type MemoryOperationEffectSpec =
	| {
			kind: 'load';
			accessByteWidth: number;
			loadVariant: MemoryLoadVariant;
			resultType: 'int' | 'float';
			addressOperandIndex: number;
	  }
	| {
			kind: 'store';
			addressOperandIndex: number;
			valueOperandIndex: number;
	  }
	| {
			kind: 'storeBytes';
			accessByteWidth: number;
	  }
	| {
			kind: 'copy';
			addressOperandIndex: number;
	  };

/** Additional semantic effects that are not expressed by stack validation alone. */
export interface InstructionEffectsSpec {
	blockClose?: BlockCloseEffectSpec;
	memory?: MemoryOperationEffectSpec;
}

/** Source-level argument constraints for parsing and validating an instruction. */
export interface SourceArgumentsSpec {
	minArguments?: number;
	maxArguments?: number;
	argumentTypes?: SourceArgumentShapeRule[] | SourceArgumentShapeRule;
	restArgumentType?: SourceArgumentShapeRule;
}

/** Complete language specification for a source instruction. */
export interface InstructionSpec<TLine = unknown> extends ValidationSpec<TLine> {
	codegen?: false;
	sourceInstruction?: false;
	sourceArguments?: SourceArgumentsSpec;
	functionDeclaration?: FunctionDeclarationInstructionSpec;
	/** Pushes an optional source operand before the binary operation. */
	inlineOperand?: true;
	docs?: InstructionDocumentation;
	stack?: StackEffectSpec<TLine>;
	effects?: InstructionEffectsSpec;
}

/** Shared spec for binary operations that require two operands of the same type. */
const binaryMatchingSpec = {
	sourceArguments: noSourceArguments,
	placement: moduleOrFunctionPlacement,
	minOperands: 2,
	operandTypes: 'matching',
} satisfies InstructionSpec;

/** Binary arithmetic may supply its right operand directly in source. */
const binaryArithmeticSpec = {
	...binaryMatchingSpec,
	sourceArguments: { maxArguments: 1, argumentTypes: 'pushValue' },
	inlineOperand: true,
} as const satisfies InstructionSpec;

/** Shared spec for binary operations that require two integer operands. */
const binaryIntegerSpec = {
	sourceArguments: { maxArguments: 1, argumentTypes: 'pushValue' },
	inlineOperand: true,
	placement: moduleOrFunctionPlacement,
	minOperands: 2,
	operandTypes: 'int',
} as const satisfies InstructionSpec;

/** Shared validation spec for unary stack operations available in modules and functions. */
const unaryModuleOrFunctionSpec = {
	placement: moduleOrFunctionPlacement,
	minOperands: 1,
} satisfies ValidationSpec;

/** Unary module/function spec variant for instructions that take no source arguments. */
const unaryNoSourceModuleOrFunctionSpec = {
	...unaryModuleOrFunctionSpec,
	sourceArguments: noSourceArguments,
} satisfies InstructionSpec;

/** Shared validation and placement rules for load instructions. */
const loadSpec = {
	sourceArguments: noSourceArguments,
	placement: moduleOrFunctionPlacement,
	minOperands: 1,
	operandTypes: 'int',
} satisfies InstructionSpec;

/** Shared spec for source memory declarations represented by multiple declaration keywords. */
const memoryDeclarationSpec = {
	codegen: false,
	sourceInstruction: false,
	placement: { sourceBlocks: ['module', 'prototype'] },
} satisfies InstructionSpec;

/** Central language spec table for parsing, placement, stack effects, and semantic effects. */
export const instructionSpecs = {
	abs: withDocsAndStack(unaryNoSourceModuleOrFunctionSpec, {
		shortDescription: 'Returns the absolute value of the top stack value.',
		inputs: ['T'],
		outputs: ['T'],
	}),
	assert: withDocsAndStack(
		{ ...unaryNoSourceModuleOrFunctionSpec, operandTypes: 'int' },
		{
			shortDescription: 'Reports whether an integer condition is nonzero when assertions are enabled.',
			inputs: ['int'],
			outputs: [],
			effect: stackMutation(1),
		}
	),
	assertEqual: withDocsAndStack(
		{
			...unaryModuleOrFunctionSpec,
			sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: ['compileTimeValue'] },
		},
		{
			shortDescription:
				'Reports exact equality of the stack value and an inline expected value when assertions are enabled.',
			inputs: ['T'],
			outputs: [],
			effect: stackMutation(1),
		}
	),
	add: withDocsAndStack(binaryArithmeticSpec, {
		shortDescription: 'Adds two numbers of the same type and pushes the result.',
		inputs: ['T', 'T'],
		outputs: ['T'],
	}),
	and: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Performs a bitwise AND on two integers.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	block: {
		sourceArguments: noSourceArguments,
		placement: {
			...moduleOrFunctionPlacement,
			block: {
				kind: 'block',
				role: 'start',
				parents: ['module', 'function', 'loop', 'block', 'if'],
				nestable: true,
				stackBlock: true,
			},
		},
		docs: { shortDescription: 'Starts a block that can be exited with branch instructions.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	blockEnd: {
		sourceArguments: { maxArguments: 1, argumentTypes: 'ifResultType' },
		placement: {
			...moduleOrFunctionPlacement,
			requiredNestedBlock: 'block',
			block: { kind: 'block', role: 'end' },
		},
		docs: { shortDescription: 'Ends a block and validates its optional result value.' },
		stack: stack({ inputs: ['T?'], outputs: ['T?'] }),
		effects: blockClose(BlockType.BLOCK, { restoreResult: true }),
	},
	branch: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'nonNegativeIntegerLiteral' },
		placement: moduleOrFunctionPlacement,
		docs: { shortDescription: 'Branches out of one or more enclosing blocks.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	branchIfTrue: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'nonNegativeIntegerLiteral' },
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Branches out of enclosing blocks when the condition is non-zero.' },
		stack: stack({ inputs: ['int'], outputs: [], effect: stackMutation(1) }),
	},
	call: {
		sourceArguments: { minArguments: 1, argumentTypes: ['identifier'], restArgumentType: 'pushValue' },
		placement: moduleOrFunctionPlacement,
		docs: { shortDescription: 'Calls a function, consuming its parameters and pushing its return values.' },
		stack: stack({ inputs: ['args...'], outputs: ['returns...'] }),
	},
	castToFloat: {
		sourceArguments: noSourceArguments,
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Converts an integer stack value to a float.' },
		stack: stack({
			inputs: ['int'],
			outputs: ['float'],
			effect: stackMutation(1, [{ kind: 'float', isNonZero: 'fromInput' }]),
		}),
	},
	castToFloat64: withDocsAndStack(unaryNoSourceModuleOrFunctionSpec, {
		shortDescription: 'Converts a numeric stack value to float64.',
		inputs: ['T'],
		outputs: ['float64'],
		effect: stackMutation(1, [{ kind: 'float64', isNonZero: 'fromInput' }]),
	}),
	castToInt: {
		sourceArguments: noSourceArguments,
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'float',
		docs: { shortDescription: 'Converts a floating-point stack value to an integer.' },
		stack: stack({
			inputs: ['float'],
			outputs: ['int'],
			effect: stackMutation(1, [{ kind: 'int', isNonZero: 'fromInput' }]),
		}),
	},
	clampAddress: {
		sourceArguments: { maxArguments: 1, argumentTypes: 'nonNegativeCompileTimeValue' },
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Clamps a pointer so it stays inside the active memory range.' },
		stack: stack({ inputs: ['ptr'], outputs: ['ptr'] }),
	},
	clampModuleAddress: {
		sourceArguments: { maxArguments: 1, argumentTypes: 'nonNegativeCompileTimeValue' },
		placement: modulePlacement,
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Clamps a pointer so it stays inside module memory.' },
		stack: stack({ inputs: ['ptr'], outputs: ['ptr'] }),
	},
	clampGlobalAddress: {
		sourceArguments: { maxArguments: 1, argumentTypes: 'nonNegativeCompileTimeValue' },
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Clamps a pointer so it stays inside global memory.' },
		stack: stack({ inputs: ['ptr'], outputs: ['ptr'] }),
	},
	clearStack: {
		sourceArguments: noSourceArguments,
		placement: moduleOrFunctionPlacement,
		docs: { shortDescription: 'Removes every value from the stack.' },
		stack: stack({ inputs: ['...'], outputs: [], effect: { consumes: 'all', produces: [], dropped: 'consumed' } }),
	},
	const: {
		codegen: false,
		sourceArguments: {
			minArguments: 2,
			maxArguments: 2,
			argumentTypes: ['constantIdentifier', 'compileTimeValue'],
		},
		placement: constantsPlacement,
		functionDeclaration: { preBody: true },
		docs: { shortDescription: 'Declares a compile-time constant.' },
	},
	constants: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: {
			block: {
				kind: 'constants',
				role: 'start',
				parents: [],
				nestable: false,
				sourceBlock: { compilesToModule: false, compilationMode: null },
			},
		},
		docs: { shortDescription: 'Starts a constants block.' },
	},
	constantsEnd: {
		codegen: false,
		sourceArguments: noSourceArguments,
		placement: {
			sourceBlocks: ['constants'],
			block: { kind: 'constants', role: 'end' },
		},
		docs: { shortDescription: 'Ends a constants block.' },
	},
	default: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'compileTimeValue' },
		placement: mapPlacement,
		docs: { shortDescription: 'Defines the fallback value for a map block.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	div: withDocsAndStack(binaryArithmeticSpec, {
		shortDescription: 'Divides the first value by the second value and pushes the quotient.',
		inputs: ['T', 'T'],
		outputs: ['T'],
	}),
	drop: withDocsAndStack(unaryNoSourceModuleOrFunctionSpec, {
		shortDescription: 'Removes the top value from the stack.',
		inputs: ['T'],
		outputs: [],
		effect: stackMutation(1),
	}),
	else: {
		sourceArguments: noSourceArguments,
		placement: {
			...moduleOrFunctionPlacement,
			requiredNestedBlock: 'if',
			block: { kind: 'if', role: 'branch' },
		},
		docs: { shortDescription: 'Starts the alternate branch of the current if block.' },
		stack: stack({ inputs: [], outputs: [] }),
		effects: blockClose(BlockType.CONDITION),
	},
	ensureNonZero: withDocsAndStack(
		{ ...unaryModuleOrFunctionSpec, sourceArguments: { maxArguments: 1, argumentTypes: 'literal' } },
		{
			shortDescription: 'Ensures the top stack value is non-zero before continuing.',
			inputs: ['T'],
			outputs: ['T'],
			effect: stackMutation(1, [{ kind: 'same', isNonZero: true }]),
		}
	),
	equal: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Compares two values and pushes 1 when they are equal, otherwise 0.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	equalToZero: withDocsAndStack(unaryNoSourceModuleOrFunctionSpec, {
		shortDescription: 'Pushes 1 when the value is zero, otherwise 0.',
		inputs: ['T'],
		outputs: ['int'],
		effect: stackMutation(1, [{ kind: 'int', isNonZero: false }]),
	}),
	exitIfTrue: {
		sourceArguments: noSourceArguments,
		placement: modulePlacement,
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Exits the enclosing module when the condition is non-zero.' },
		stack: stack({ inputs: ['int'], outputs: [] }),
	},
	function: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: {
			block: {
				kind: 'function',
				role: 'start',
				parents: [],
				nestable: false,
				sourceBlock: { compilesToModule: false, compilationMode: 'function' },
			},
		},
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: { shortDescription: 'Starts a function block.' },
	},
	functionEnd: {
		codegen: false,
		sourceArguments: { argumentTypes: 'functionTypeIdentifier' },
		placement: {
			...functionPlacement,
			block: { kind: 'function', role: 'end' },
		},
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: { shortDescription: 'Ends a function and records its return signature.' },
		stack: stack({ inputs: ['returns...'], outputs: [] }),
	},
	greaterOrEqual: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Pushes 1 when the first value is greater than or equal to the second value.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	greaterOrEqualUnsigned: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Compares two values as unsigned numbers and pushes the result.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	greaterThan: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Pushes 1 when the first value is greater than the second value.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	if: {
		sourceArguments: noSourceArguments,
		placement: {
			...moduleOrFunctionPlacement,
			block: {
				kind: 'if',
				role: 'start',
				parents: ['module', 'function', 'loop', 'block', 'if'],
				nestable: true,
				stackBlock: true,
			},
		},
		minOperands: 1,
		operandTypes: 'int',
		docs: { shortDescription: 'Starts a conditional block when the condition is non-zero.' },
		stack: stack({ inputs: ['int'], outputs: [], effect: stackMutation(1) }),
	},
	ifEnd: {
		sourceArguments: { argumentTypes: 'ifResultType' },
		placement: {
			...moduleOrFunctionPlacement,
			requiredNestedBlock: 'if',
			block: { kind: 'if', role: 'end' },
		},
		docs: { shortDescription: 'Ends an if block and validates its optional result value.' },
		stack: stack({ inputs: ['T?'], outputs: ['T?'] }),
		effects: blockClose(BlockType.CONDITION, { restoreResult: true }),
	},
	lessOrEqual: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Pushes 1 when the first value is less than or equal to the second value.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	lessThan: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Pushes 1 when the first value is less than the second value.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	load: loadInstruction(loadSpec, {
		loadVariant: 'i32',
		accessByteWidth: WORD_MEMORY_ACCESS_WIDTH,
		resultType: 'int',
		shortDescription: 'Loads a 32-bit integer value from memory.',
		output: 'int',
		effect: stackMutation(1, [{ kind: 'int', isNonZero: false }]),
	}),
	load8u: loadInstruction(loadSpec, {
		loadVariant: 'i32_8u',
		accessByteWidth: BYTE_MEMORY_ACCESS_WIDTH,
		resultType: 'int',
		shortDescription: 'Loads an unsigned 8-bit integer value from memory.',
		output: 'int',
		effect: stackMutation(1, [{ kind: 'int', isNonZero: false }]),
	}),
	load16u: loadInstruction(loadSpec, {
		loadVariant: 'i32_16u',
		accessByteWidth: HALF_WORD_MEMORY_ACCESS_WIDTH,
		resultType: 'int',
		shortDescription: 'Loads an unsigned 16-bit integer value from memory.',
		output: 'int',
		effect: stackMutation(1, [{ kind: 'int', isNonZero: false }]),
	}),
	load8s: loadInstruction(loadSpec, {
		loadVariant: 'i32_8s',
		accessByteWidth: BYTE_MEMORY_ACCESS_WIDTH,
		resultType: 'int',
		shortDescription: 'Loads a signed 8-bit integer value from memory.',
		output: 'int',
		effect: stackMutation(1, [{ kind: 'int', isNonZero: false }]),
	}),
	load16s: loadInstruction(loadSpec, {
		loadVariant: 'i32_16s',
		accessByteWidth: HALF_WORD_MEMORY_ACCESS_WIDTH,
		resultType: 'int',
		shortDescription: 'Loads a signed 16-bit integer value from memory.',
		output: 'int',
		effect: stackMutation(1, [{ kind: 'int', isNonZero: false }]),
	}),
	loadFloat: loadInstruction(loadSpec, {
		loadVariant: 'f32',
		accessByteWidth: WORD_MEMORY_ACCESS_WIDTH,
		resultType: 'float',
		shortDescription: 'Loads a float32 value, or a float64 value through a typed float64 pointer.',
		output: 'float',
		effect: stackMutation(1, [{ kind: 'float', isNonZero: false }]),
	}),
	local: {
		codegen: false,
		sourceArguments: {
			minArguments: 2,
			maxArguments: 2,
			argumentTypes: ['functionTypeIdentifier', 'identifier'],
		},
		placement: moduleOrFunctionPlacement,
		docs: { shortDescription: 'Declares a local variable in the current function or module block.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	localSet: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		docs: { shortDescription: 'Stores the top stack value into a local variable.' },
		stack: stack({ inputs: ['T'], outputs: [] }),
	},
	loop: {
		sourceArguments: { maxArguments: 1, argumentTypes: 'nonNegativeIntegerCompileTimeValue' },
		placement: {
			...moduleOrFunctionPlacement,
			block: {
				kind: 'loop',
				role: 'start',
				parents: ['module', 'function', 'loop', 'block', 'if'],
				nestable: true,
				stackBlock: true,
			},
		},
		docs: { shortDescription: 'Starts a loop block that repeats until a branch exits it.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	'#loopCap': {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'nonNegativeIntegerLiteral' },
		placement: moduleOrFunctionPlacement,
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: { shortDescription: 'Sets the loop iteration cap for loops in the current block.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	'#export': {
		codegen: false,
		sourceArguments: { maxArguments: 1, argumentTypes: 'identifier' },
		placement: functionPlacement,
		functionDeclaration: { preBody: true },
		docs: {
			shortDescription: 'Exports the current function under the provided name, or the function name if omitted.',
		},
		stack: stack({ inputs: [], outputs: [] }),
	},
	'#import': {
		codegen: false,
		sourceArguments: {
			minArguments: 1,
			maxArguments: 1,
			argumentTypes: 'identifierOrStringLiteral',
		},
		placement: functionPlacement,
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: {
			shortDescription: 'Declares that the current function is provided by a WebAssembly host import.',
		},
		stack: stack({ inputs: [], outputs: [] }),
	},
	'#skipExecution': {
		codegen: false,
		sourceArguments: noSourceArguments,
		placement: modulePlacement,
		docs: { shortDescription: 'Skips the current module during main execution.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	'#impure': {
		codegen: false,
		sourceArguments: noSourceArguments,
		placement: functionPlacement,
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: { shortDescription: 'Allows the current function to perform explicit memory IO.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	loopEnd: {
		sourceArguments: noSourceArguments,
		placement: {
			...moduleOrFunctionPlacement,
			requiredNestedBlock: 'loop',
			block: { kind: 'loop', role: 'end' },
		},
		docs: { shortDescription: 'Ends a loop block and branches back to the start of the loop.' },
		stack: stack({ inputs: ['T?'], outputs: ['T?'] }),
		effects: blockClose(BlockType.LOOP, { restoreResult: true }),
	},
	loopIndex: {
		sourceArguments: noSourceArguments,
		placement: loopPlacement,
		docs: { shortDescription: 'Pushes the current zero-based loop iteration index.' },
		stack: stack({ inputs: [], outputs: ['int'], effect: stackMutation(0, [{ kind: 'int', isNonZero: false }]) }),
	},
	map: {
		sourceArguments: { minArguments: 1, maxArguments: 2, argumentTypes: 'mapValue' },
		placement: mapPlacement,
		docs: { shortDescription: 'Starts a map case inside a map block.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	mapBegin: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'typeIdentifier' },
		placement: {
			...moduleOrFunctionPlacement,
			disallowedNestedBlocks: ['map'],
			block: {
				kind: 'map',
				role: 'start',
				parents: ['module', 'function', 'loop', 'block', 'if'],
				nestable: false,
			},
		},
		docs: { shortDescription: 'Starts a map block that chooses a value from map cases.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	mapEnd: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'typeIdentifier' },
		placement: {
			...mapPlacement,
			block: { kind: 'map', role: 'end' },
		},
		minOperands: 1,
		docs: { shortDescription: 'Ends a map block and leaves the selected mapped value on the stack.' },
		stack: stack({ inputs: ['T'], outputs: ['T'] }),
	},
	memoryCopy: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'nonNegativeCompileTimeValue' },
		placement: moduleOrFunctionPlacement,
		minOperands: 2,
		operandTypes: 'int',
		docs: { shortDescription: 'Copies memory from one pointer range to another.' },
		stack: stack({ inputs: ['ptr', 'ptr'], outputs: [], effect: stackMutation(2) }),
		effects: { memory: { kind: 'copy', addressOperandIndex: 0 } },
	},
	min: withDocsAndStack(binaryArithmeticSpec, {
		shortDescription: 'Pushes the smaller of two values of the same type.',
		inputs: ['T', 'T'],
		outputs: ['T'],
		effect: stackMutation(2, [{ kind: 'same', isNonZero: false }]),
	}),
	max: withDocsAndStack(binaryArithmeticSpec, {
		shortDescription: 'Pushes the larger of two values of the same type.',
		inputs: ['T', 'T'],
		outputs: ['T'],
		effect: stackMutation(2, [{ kind: 'same', isNonZero: false }]),
	}),
	mul: withDocsAndStack(binaryArithmeticSpec, {
		shortDescription: 'Multiplies two numbers of the same type and pushes the result.',
		inputs: ['T', 'T'],
		outputs: ['T'],
	}),
	module: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'moduleName' },
		placement: {
			block: {
				kind: 'module',
				role: 'start',
				parents: [],
				nestable: false,
				sourceBlock: { compilesToModule: true, compilationMode: 'module' },
			},
		},
		docs: { shortDescription: 'Starts a module block.' },
	},
	moduleEnd: {
		codegen: false,
		sourceArguments: noSourceArguments,
		placement: {
			...modulePlacement,
			block: { kind: 'module', role: 'end' },
		},
		docs: { shortDescription: 'Ends a module block.' },
	},
	prototype: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: {
			block: {
				kind: 'prototype',
				role: 'start',
				parents: [],
				nestable: false,
				sourceBlock: { compilesToModule: false, compilationMode: null },
			},
		},
		docs: { shortDescription: 'Starts a reusable module memory shape block.' },
	},
	prototypeEnd: {
		codegen: false,
		sourceArguments: noSourceArguments,
		placement: {
			sourceBlocks: ['prototype'],
			block: { kind: 'prototype', role: 'end' },
		},
		docs: { shortDescription: 'Ends a reusable module memory shape block.' },
	},
	shape: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: modulePlacement,
		docs: { shortDescription: 'Expands a prototype memory shape into the current module.' },
	},
	notEqual: withDocsAndStack(binaryMatchingSpec, {
		shortDescription: 'Compares two values and pushes 1 when they are not equal, otherwise 0.',
		inputs: ['T', 'T'],
		outputs: ['int'],
		effect: stackMutation(2, [{ kind: 'int', isNonZero: false }]),
	}),
	notZero: withDocsAndStack(unaryNoSourceModuleOrFunctionSpec, {
		shortDescription: 'Pushes 1 when the value is non-zero, otherwise 0.',
		inputs: ['T'],
		outputs: ['int'],
		effect: stackMutation(1, [{ kind: 'int', isNonZero: 'fromInput' }]),
	}),
	or: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Performs a bitwise OR on two integers.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	param: {
		codegen: false,
		sourceArguments: {
			minArguments: 2,
			maxArguments: 2,
			argumentTypes: ['functionTypeIdentifier', 'identifier'],
		},
		placement: functionPlacement,
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: { shortDescription: 'Declares a parameter for the current function.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	paramShape: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: functionPlacement,
		functionDeclaration: { preBody: true, importedFunction: true },
		docs: { shortDescription: 'Expands a prototype memory shape into pointer parameters for the current function.' },
		stack: stack({ inputs: [], outputs: [] }),
	},
	push: {
		sourceArguments: { minArguments: 1, maxArguments: 1 },
		placement: moduleOrFunctionPlacement,
		docs: { shortDescription: 'Pushes a literal, memory value, local value, address, or constant onto the stack.' },
		stack: stack({ inputs: [], outputs: ['T'] }),
	},
	pushShape: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: modulePlacement,
		docs: {
			shortDescription: 'Pushes addresses for the current module memory items defined by a prototype shape.',
		},
		stack: stack({ inputs: [], outputs: ['ptr'] }),
	},
	remainder: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Divides one integer by another and pushes the remainder.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	return: {
		sourceArguments: noSourceArguments,
		placement: functionPlacement,
		docs: { shortDescription: 'Returns from the current function with the values on the stack.' },
		stack: stack({
			inputs: ['returns...'],
			outputs: ['never'],
			effect: { consumes: 'all', produces: [], dropped: 'consumed' },
		}),
	},
	round: {
		sourceArguments: noSourceArguments,
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'float',
		docs: { shortDescription: 'Rounds a float value to the nearest whole value.' },
		stack: stack({
			inputs: ['float'],
			outputs: ['float'],
			effect: stackMutation(1, [{ kind: 'same', isNonZero: false }]),
		}),
	},
	shiftLeft: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Shifts an integer left by the requested number of bits.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	shiftRight: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Shifts an integer right by the requested number of bits.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	shiftRightUnsigned: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Shifts an integer right without preserving the sign bit.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	sqrt: {
		sourceArguments: noSourceArguments,
		placement: moduleOrFunctionPlacement,
		minOperands: 1,
		operandTypes: 'float',
		docs: { shortDescription: 'Pushes the square root of a float value.' },
		stack: stack({
			inputs: ['float'],
			outputs: ['float'],
			effect: stackMutation(1, [{ kind: 'same', isNonZero: false }]),
		}),
	},
	store: {
		sourceArguments: noSourceArguments,
		placement: moduleOrFunctionPlacement,
		minOperands: 2,
		operandTypes: ['int'],
		docs: { shortDescription: 'Stores a value at the memory address on the stack.' },
		stack: stack({ inputs: ['ptr', 'T'], outputs: [], effect: stackMutation(2) }),
		effects: { memory: { kind: 'store', addressOperandIndex: 0, valueOperandIndex: 1 } },
	},
	storeBytes: {
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'nonNegativeIntegerLiteral' },
		placement: moduleOrFunctionPlacement,
		validateOperands: line => {
			const count = (line as StoreBytesSourceLine).arguments[0].value;
			return {
				minOperands: count + 1,
				operandTypes: new Array(count + 1).fill('int'),
			};
		},
		docs: { shortDescription: 'Stores a fixed number of integer bytes at the memory address on the stack.' },
		stack: {
			inputs: ['bytes...', 'ptr'],
			outputs: [],
			effect: { consumes: { argumentValueIndex: 0, add: 1 }, produces: [] },
			resolve: line => {
				const count = (line as StoreBytesSourceLine).arguments[0]?.value;

				if (!Number.isFinite(count) || count < 0) {
					return { inputs: ['bytes...', 'ptr'], outputs: [] };
				}

				return { inputs: [...new Array(count).fill('int'), 'ptr'], outputs: [] };
			},
		},
		effects: { memory: { kind: 'storeBytes', accessByteWidth: BYTE_MEMORY_ACCESS_WIDTH } },
	},
	sub: withDocsAndStack(binaryArithmeticSpec, {
		shortDescription: 'Subtracts matching numbers, an integer byte offset, or two addresses and pushes the result.',
		inputs: ['T', 'T'],
		outputs: ['T'],
	}),
	use: {
		codegen: false,
		sourceArguments: { minArguments: 1, maxArguments: 1, argumentTypes: 'identifier' },
		placement: constantNamespaceImportPlacement,
		functionDeclaration: { preBody: true },
		docs: { shortDescription: 'Imports declarations from another module or constants block.' },
	},
	xor: withDocsAndStack(binaryIntegerSpec, {
		shortDescription: 'Performs a bitwise XOR on two integers.',
		inputs: ['int', 'int'],
		outputs: ['int'],
	}),
	memoryDeclaration: withDocsAndStack(memoryDeclarationSpec, {
		shortDescription: 'Declares memory storage for values used by the module.',
		inputs: [],
		outputs: [],
	}),
} satisfies Record<string, InstructionSpec>;

/**
 * Returns the registered instruction spec for a language instruction or memory declaration.
 * The conditional return type preserves precise results for known instruction names while
 * still allowing loose string lookups for parser and tooling callers.
 * Memory declaration instructions are represented by many source keywords, but
 * they intentionally share the single `memoryDeclaration` spec entry.
 *
 * @param instruction - Instruction keyword or memory declaration keyword to look up.
 * @returns The matching instruction spec, or undefined for unknown instructions.
 */
export function getInstructionSpec<TInstruction extends string>(
	instruction: TInstruction
): InstructionSpecLookup<TInstruction> {
	if (memoryDeclarationInstructions.includes(instruction as MemoryDeclarationInstruction)) {
		return instructionSpecs.memoryDeclaration as InstructionSpecLookup<TInstruction>;
	}

	if (instruction in instructionSpecs) {
		return instructionSpecs[instruction as InstructionSpecName] as InstructionSpecLookup<TInstruction>;
	}

	return undefined as InstructionSpecLookup<TInstruction>;
}
