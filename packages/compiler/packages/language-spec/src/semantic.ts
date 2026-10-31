import type { WASMInstructionCode, WasmTypeValue } from '@8f4e/compiler-wasm-utils';
import type {
	ArgumentCompileTimeExpression,
	ArgumentIdentifier,
	ArgumentLiteral,
	ArgumentStringLiteral,
	MemoryPointerIdentifier,
} from './arguments';
import type { AssertionCodegenSites } from './assertions';
import type {
	ArrayMemoryDeclarationLine,
	AssertEqualLine,
	CallLine,
	CompilerASTLine,
	DefaultLine,
	InlineOperandLine,
	LocalSetLine,
	LoopLine,
	MapLine,
	MemoryCopyLine,
	PrototypeAST,
	PushArgument,
	PushLine,
	PushShapeLine,
} from './ast';
import type { FunctionMetadata, FunctionRegistry, FunctionTypeRegistry, SourceMetadata } from './compiled';
import type { CompilerDiagnosticContext } from './diagnostics';
import type { WasmFunctionLayout } from './functionLayout';
import type { FunctionValueType } from './functionTypes';
import type { CodegenInstructionName, CompilerSourceBlockType, CompilerSourceCompilationMode } from './instructions';
import type {
	ArrayDeclarationInstruction,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	PlannedMemoryModule,
	PointeeBaseType,
	ResolvedMemoryDeclaration,
} from './memory';
import type { ProjectMemoryAliasLookup } from './project';

/** Proven byte range associated with an address expression or memory boundary. */
export interface MemoryAddressRange {
	source: 'memory-start' | 'memory-end' | 'module-start' | 'module-end' | 'module-nth-memory-start';
	byteAddress: number;
	safeByteLength: number;
	moduleId?: string;
	memoryId?: string;
}

/** Compiler metadata carried alongside values known to represent memory addresses. */
export interface AddressMetadata {
	/**
	 * Proven safe byte range for memory operations at this exact value.
	 * Pointer arithmetic may shrink or remove this range when the compiler can no
	 * longer prove the current address is safe.
	 */
	safeRange?: MemoryAddressRange;
	/**
	 * Broader range this address is allowed to clamp back into.
	 * This does not prove the current value is safe; it preserves the original
	 * allocation/module range so `clampAddress` can recover a safe address after
	 * pointer arithmetic moves outside `safeRange`.
	 */
	clampRange?: MemoryAddressRange;
	/** Proven access width after an explicit address clamp. */
	safeAccessByteWidth?: number;
}

export type Const = {
	value: number;
	isInteger: boolean;
	isFloat64?: boolean;
	/** Address metadata when this constant value is an address. */
	address?: AddressMetadata;
};

export type ResolvedArgumentLiteral = ArgumentLiteral & {
	/** Address metadata when semantic reference resolution resolves this literal from an address expression. */
	address?: AddressMetadata;
};

/** Scalar local value facts, independent of WebAssembly storage. */
export interface ScalarLocalMetadata {
	isInteger: boolean;
	isFloat64?: boolean;
	pointeeBaseType?: undefined;
}

/** Pointer local value facts, independent of WebAssembly storage. */
export interface PointerLocalMetadata {
	isInteger: true;
	isFloat64?: false;
	pointeeBaseType: PointeeBaseType;
	pointerDepth: number;
	pointeeElementCount?: number;
}

export type LocalValueMetadata = ScalarLocalMetadata | PointerLocalMetadata;
export type LocalMap = Record<string, LocalValueMetadata>;

export type ScalarLocalBinding = ScalarLocalMetadata & { index: number };
export type PointerLocalBinding = PointerLocalMetadata & { index: number };
export type LocalBinding = ScalarLocalBinding | PointerLocalBinding;
export type LocalStorageMap = Record<string, LocalBinding>;

/** One resolved source declaration; its identity remains stable across later stages. */
export interface SourceLocalBinding {
	id: number;
	name: string;
	type: FunctionValueType;
	parameterIndex?: number;
}

/** Mutable namespace state available while compiling modules, constants, and functions. */
export interface Namespace {
	moduleName: string | undefined;
	functions?: FunctionRegistry;
	prototypeShapeIds: string[];
}

export type CompilationMode = CompilerSourceCompilationMode;

/** Mutable state used by semantic compiler passes. */
export interface CompilationContext extends BlockState {
	namespace: Namespace;
	locals: LocalMap;
	stack: Stack;
	memoryPlan: MemoryLayoutPlan;
	memoryAliases: ProjectMemoryAliasLookup;
	currentPlannedModule?: PlannedMemoryModule;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	byteCode: Array<WASMInstructionCode | WasmTypeValue | number>;
	mode: CompilationMode;
	codeBlockId?: string;
	codeBlockType?: CompilerSourceBlockType;
	projectBlockId?: number;
	source?: SourceMetadata;
	currentFunctionId?: string;
	currentFunctionName?: string;
	currentFunctionMetadata?: FunctionMetadata;
	functionTypeRegistry?: FunctionTypeRegistry;
	prototypeShapes?: Readonly<Record<string, PrototypeAST>>;
}

/** Compilation context narrowed to a module body. */
export interface ModuleCompilationContext extends CompilationContext {
	mode: 'module';
}

/** Compilation context narrowed to a function body with function metadata resolved. */
export interface FunctionCompilationContext extends CompilationContext {
	mode: 'function';
	codeBlockType: 'function';
	currentFunctionId: string;
	currentFunctionName: string;
	currentFunctionMetadata: FunctionMetadata;
	functionTypeRegistry: FunctionTypeRegistry;
}

export type StackValueType = 'int' | 'float' | 'float64';

/** Pointee type facts for an address. These facts do not include provenance or bounds guarantees. */
export interface PointeeMetadata {
	baseType: PointeeBaseType;
	pointerDepth: number;
}

/** Type and value facts known about one ordinary value on the compiler analysis stack. */
export interface StackValue {
	kind: 'value';
	valueType: StackValueType;
	/** A flag for the div operation to check if the divisor is zero. */
	isNonZero?: boolean;
	/** Exact scalar value when the compiler can still prove it at this stack position. */
	knownValue?: number;
}

/**
 * Type and value facts known about one address-like integer.
 * `pointsTo` describes how to interpret the address; only `address.safeRange` or
 * `address.safeAccessByteWidth` proves that a memory access is statically safe.
 */
export interface StackAddress {
	kind: 'address';
	valueType: 'int';
	address: AddressMetadata;
	pointsTo?: PointeeMetadata;
	/** A flag for the div operation to check if the divisor is zero. */
	isNonZero?: boolean;
	/** Exact integer address when the compiler can still prove it at this stack position. */
	knownValue?: number;
}

/** Type and value facts known about one item on the compiler analysis stack. */
export type StackItem = StackValue | StackAddress;

export type Stack = StackItem[];

/** Before-and-after stack analysis captured for a compiled source line. */
export interface StackAnalysisResult {
	stackBefore: Stack;
	stackAfter: Stack;
	consumedOperands: Stack;
	producedStackItems: Stack;
	droppedStackItems?: Stack;
}

export type StackAnalysisNumericValueKind = 'int32' | 'float32' | 'float64';

export interface StackAnalysisMapFact {
	inputKind: StackAnalysisNumericValueKind;
	outputKind: StackAnalysisNumericValueKind;
}

export interface StackAnalysisClampFact {
	accessByteWidth: number;
	range?: MemoryAddressRange;
}

export interface StackAnalysisLineFacts {
	stackAnalysis: StackAnalysisResult;
	targetFunctionId?: string;
	numericOperandKind?: StackAnalysisNumericValueKind;
	map?: StackAnalysisMapFact;
	clamp?: StackAnalysisClampFact;
}

export interface ConstantResolutionLineFacts {
	arguments?: CompilerASTLine['arguments'];
}

export interface ConstantResolutionBlockFacts {
	lineFacts: Array<ConstantResolutionLineFacts | undefined>;
}

export interface MemoryReferenceResolutionLineFacts {
	arguments?: CompilerASTLine['arguments'];
}

export interface MemoryReferenceResolutionBlockFacts {
	lineFacts: Array<MemoryReferenceResolutionLineFacts | undefined>;
}

export interface MemoryReferenceResolutionReport {
	prototypes: readonly MemoryReferenceResolutionBlockFacts[];
	modules: readonly MemoryReferenceResolutionBlockFacts[];
	constants: readonly MemoryReferenceResolutionBlockFacts[];
	functions: readonly MemoryReferenceResolutionBlockFacts[];
	declarationSourcesByModuleId: Record<string, MemoryReferenceResolutionBlockFacts>;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
}

/** Bytecode emission state, independent of semantic analysis and memory planning. */
export interface CodegenContext extends BlockState<CodegenLoopBlockStackFrame>, CompilerDiagnosticContext {
	/** Planned native assertion calls keyed by physical source line; absent when disabled. */
	assertionCalls?: AssertionCodegenSites;
	byteCode: Array<WASMInstructionCode | WasmTypeValue | number>;
	locals: LocalStorageMap;
	nextLocalIndex: number;
	functionLayout: WasmFunctionLayout;
	functionTypeRegistry?: FunctionTypeRegistry;
}

export type ResolvedMapValueArgument = ResolvedArgumentLiteral | ArgumentStringLiteral;

export type ResolvedMapLine = Omit<MapLine, 'arguments'> & {
	arguments: [ResolvedMapValueArgument, ResolvedMapValueArgument];
};

export type ResolvedDefaultLine = Omit<DefaultLine, 'arguments'> & {
	arguments: [ResolvedArgumentLiteral];
};

export type ResolvedMemoryCopyLine = Omit<MemoryCopyLine, 'arguments'> & {
	arguments: [ResolvedArgumentLiteral];
};

export type ResolvedLoopLine = Omit<LoopLine, 'arguments'> & {
	arguments: [ResolvedArgumentLiteral];
};

export type ArrayDeclarationInitializerArgument =
	| ArgumentCompileTimeExpression
	| ArgumentIdentifier
	| ResolvedArgumentLiteral;

export type ArrayDeclarationLine = Omit<ArrayMemoryDeclarationLine, 'instruction' | 'arguments'> & {
	instruction: ArrayDeclarationInstruction;
	arguments: [ArgumentIdentifier, ArgumentLiteral, ...ArrayDeclarationInitializerArgument[]];
};

export type LiteralPushLine = Omit<PushLine, 'arguments'> & {
	arguments: [ResolvedArgumentLiteral | ArgumentStringLiteral];
};

export type DeferredPushLine = Omit<PushLine, 'arguments'> & {
	arguments: [ArgumentCompileTimeExpression | ArgumentIdentifier];
};

export type ResolvedMemoryPushLine = Omit<PushLine, 'arguments'> & {
	arguments: [ArgumentIdentifier];
	resolvedTarget: {
		kind: 'memory';
		memoryItem: ResolvedMemoryDeclaration;
	};
};

export type ResolvedMemoryPointerPushLine = Omit<PushLine, 'arguments'> & {
	arguments: [MemoryPointerIdentifier];
	resolvedTarget: {
		kind: 'memory-pointer';
		memoryItem: ResolvedMemoryDeclaration;
	};
};

export type ResolvedLocalPushLine = Omit<PushLine, 'arguments'> & {
	arguments: [ArgumentIdentifier];
	resolvedTarget: {
		kind: 'local';
		binding: SourceLocalBinding;
	};
};

export type ResolvedLocalPointerPushLine = Omit<PushLine, 'arguments'> & {
	arguments: [MemoryPointerIdentifier];
	resolvedTarget: {
		kind: 'local-pointer';
		binding: SourceLocalBinding;
	};
};

export type ResolvedPushLine =
	| ResolvedMemoryPushLine
	| ResolvedMemoryPointerPushLine
	| ResolvedLocalPushLine
	| ResolvedLocalPointerPushLine;

export type CodegenPushLine = LiteralPushLine | ResolvedPushLine;
export type SemanticPushLine = CodegenPushLine | DeferredPushLine;

export type ResolvedLocalSetLine = LocalSetLine & { binding: SourceLocalBinding };

export type SemanticCallLine = Omit<CallLine, 'arguments'> & {
	arguments: [ArgumentIdentifier, ...PushArgument[]];
	inlineArgumentPushes?: CodegenPushLine[];
};

export type SemanticInlineOperandLine = InlineOperandLine & {
	inlineOperandPush?: SemanticPushLine;
};

export type SemanticAssertEqualLine = AssertEqualLine & {
	expectedPush: CodegenPushLine;
};

export type PushShapeExpansion = {
	pushLine: CodegenPushLine;
	pointerType: FunctionValueType;
};

export type ResolvedPushShapeLine = Omit<PushShapeLine, 'arguments'> & {
	arguments: [ArgumentIdentifier];
	shapeExpansions: PushShapeExpansion[];
};

export type SemanticReferenceLine<TLine extends CompilerASTLine = CompilerASTLine> = TLine extends InlineOperandLine
	? SemanticInlineOperandLine
	: TLine extends DefaultLine
		? ResolvedDefaultLine | DefaultLine
		: TLine extends AssertEqualLine
			? SemanticAssertEqualLine
			: TLine extends CallLine
				? SemanticCallLine | CallLine
				: TLine extends MapLine
					? ResolvedMapLine
					: TLine extends LocalSetLine
						? ResolvedLocalSetLine
						: TLine extends PushLine
							? SemanticPushLine
							: TLine extends PushShapeLine
								? ResolvedPushShapeLine
								: TLine extends LoopLine
									? ResolvedLoopLine
									: TLine extends MemoryCopyLine
										? ResolvedMemoryCopyLine | MemoryCopyLine
										: TLine extends ArrayDeclarationLine
											? ArrayDeclarationLine
											: TLine;

/** Resolved instructions that remain after declaration processing. */
export type ExecutableInstructionLine = Extract<SemanticReferenceLine, { instruction: CodegenInstructionName }>;

export const BlockType = {
	MODULE: 0,
	LOOP: 1,
	CONDITION: 2,
	FUNCTION: 3,
	BLOCK: 4,
	CONSTANTS: 5,
	MAP: 6,
} as const;

export type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType];

/** One key/value row collected from a `map` block. */
export interface MapRow {
	keyValue: number;
	valueValue: number;
	valueIsInteger: boolean;
	valueIsFloat64?: boolean;
}

/** Accumulated state for validating and compiling the current `map` block. */
export interface MapBlockState {
	inputIsInteger: boolean;
	inputIsFloat64: boolean;
	rows: MapRow[];
	defaultValue?: number;
	defaultIsInteger?: boolean;
	defaultIsFloat64?: boolean;
	defaultSet: boolean;
}

/** Common result expectation tracked for every open block frame. */
interface BlockStackFrameBase {
	expectedResultTypes: Array<'int' | 'float'>;
}

/** Block stack frame for an open module block. */
export interface ModuleBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.MODULE;
}

/** Block stack frame for an open function block. */
export interface FunctionBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.FUNCTION;
}

/** Block stack frame for an open generic `block`. */
export interface GenericBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.BLOCK;
}

/** Block stack frame for an open conditional block. */
export interface ConditionBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.CONDITION;
}

/** Block stack frame for an open constants block. */
export interface ConstantsBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.CONSTANTS;
}

/** Stack-analysis frame for an open loop. */
export interface LoopBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.LOOP;
}

/** Backend loop frame with its generated WebAssembly counter slot. */
export interface CodegenLoopBlockStackFrame extends LoopBlockStackFrame {
	loopCounterLocal: LocalBinding;
}

/** Block stack frame for an open map block and its accumulated rows. */
export interface MapBlockStackFrame extends BlockStackFrameBase {
	blockType: typeof BlockType.MAP;
	mapState: MapBlockState;
}

export type BlockStackFrame =
	| ModuleBlockStackFrame
	| FunctionBlockStackFrame
	| GenericBlockStackFrame
	| ConditionBlockStackFrame
	| ConstantsBlockStackFrame
	| LoopBlockStackFrame
	| MapBlockStackFrame;

export type BlockStack = BlockStackFrame[];

/** Mutable block tracking shared by analysis and bytecode emission. */
export interface BlockState<TLoop extends LoopBlockStackFrame = LoopBlockStackFrame> {
	blockStack: Array<Exclude<BlockStackFrame, LoopBlockStackFrame> | TLoop>;
	activeLoopBlocks: TLoop[];
	activeMapBlock?: MapBlockStackFrame;
}

export type InstructionCompiler<
	TLine extends CompilerASTLine = CompilerASTLine,
	TContext extends CodegenContext = CodegenContext,
> = (line: TLine, context: TContext, facts: StackAnalysisLineFacts) => TContext;
