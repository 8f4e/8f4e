import {
	f32const,
	f64const,
	i32const,
	localSet,
	signedLEB128,
	WASM_BLOCK,
	WASM_END,
	WASM_TYPE_VOID,
} from '@8f4e/compiler-wasm-utils';
import type {
	CodegenContext,
	ExecutableInstructionLine,
	FunctionInlineCalls,
	InlineFunctionBody,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { compileCodegenLine } from './compileLine';
import { createCodegenContext } from './createCodegenContext';
import { functionValueTypeToWasmType } from './functionValueType';
import { getOrRegisterFunctionType } from './instructionCompilers/utils/functionTypeRegistry';
import { getCodegenLocals } from './localStorage';

function compileInlineBody(body: InlineFunctionBody, parent: CodegenContext): void {
	const context = createCodegenContext(
		{
			...body.diagnosticContext,
			functionLayout: parent.functionLayout,
			functionTypeRegistry: parent.functionTypeRegistry,
			assertionCalls: body.assertionCalls,
			nextLocalIndex: parent.nextLocalIndex,
			blockStack: [{ blockType: BlockType.FUNCTION, expectedResultTypes: [] }],
		},
		body.bindings
	);
	for (const binding of [...body.bindings].reverse()) {
		if (binding.parameterIndex !== undefined) parent.byteCode.push(...localSet(context.locals[binding.id].index));
	}
	// Wasm function locals start at zero on every invocation, including calls inside loops.
	for (const binding of body.bindings) {
		if (binding.parameterIndex !== undefined) continue;
		const local = context.locals[binding.id];
		parent.byteCode.push(
			...(local.isInteger ? i32const(0) : local.isFloat64 ? f64const(0) : f32const(0)),
			...localSet(local.index)
		);
	}
	for (const { line, facts } of body.operations) compileCodegenLine(line, facts, context);
	const results = body.signature.returns.map(functionValueTypeToWasmType);
	const blockType =
		results.length === 0
			? [WASM_TYPE_VOID]
			: results.length === 1
				? [results[0]]
				: signedLEB128(getOrRegisterFunctionType(parent.functionTypeRegistry!, { params: [], results }));
	// Reproduce the callee's implicit function label, keeping branches and operand-stack boundaries local.
	parent.byteCode.push(WASM_BLOCK, ...blockType, ...context.byteCode, WASM_END);
	parent.nextLocalIndex = context.nextLocalIndex;
	(parent.inlinedLocals ??= []).push(...getCodegenLocals(context));
}

/** Emits original analyzed operations with selected calls expanded in isolated local/control scopes. */
export function compileBody(
	body: readonly { line: ExecutableInstructionLine }[],
	facts: readonly StackAnalysisLineFacts[],
	context: CodegenContext,
	inlineCalls?: FunctionInlineCalls
): void {
	for (const [index, { line }] of body.entries()) {
		const inline = inlineCalls?.get(index);
		if (inline) compileInlineBody(inline, context);
		else compileCodegenLine(line, facts[index], context);
	}
}
