import {
	ErrorCode,
	getError,
	getMemoryBaseType,
	isReferenceSlotLine,
	type ModuleAST,
	type PointeeBaseType,
	type ResolvedReferenceSlot,
} from '@8f4e/language-spec';
import {
	type MemoryReferenceResolutionContext,
	resolveIntermoduleMemoryTarget,
} from './resolveMemoryExpressionOperand';

/** Resolves fixed module bindings against the completed allocation plan. */
export function resolveReferenceSlots(ast: ModuleAST, context: MemoryReferenceResolutionContext) {
	const slots: Record<string, ResolvedReferenceSlot> = Object.create(null);
	const diagnosticContext = {
		codeBlockId: ast.id,
		codeBlockType: 'module' as const,
		projectBlockId: ast.projectBlockId,
		source: ast.source,
	};
	const localNames = new Set(
		ast.lines.filter(line => line.instruction === 'local').map(line => line.arguments[1].value)
	);
	for (const line of ast.lines) {
		if (!isReferenceSlotLine(line)) continue;
		const [name, target] = line.arguments;
		if (Object.hasOwn(slots, name.value) || context.currentModule!.memory[name.value] || localNames.has(name.value)) {
			throw getError(ErrorCode.DUPLICATE_IDENTIFIER, line, diagnosticContext, { identifier: name.value });
		}
		const requestedModuleId = target.scope === 'intermodule' ? target.targetModuleId : ast.id;
		const resolved = resolveIntermoduleMemoryTarget(context, requestedModuleId, target.targetMemoryId);
		const memory = resolved.targetMemory;
		if (!memory) {
			throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, diagnosticContext, { identifier: target.value });
		}
		const baseType = line.instruction.slice(0, -1) as PointeeBaseType;
		if (memory.pointerDepth !== 0 || getMemoryBaseType(memory) !== baseType) {
			throw getError(ErrorCode.TYPE_MISMATCH, line, diagnosticContext);
		}
		slots[name.value] = {
			id: name.value,
			type: line.instruction,
			lineNumber: line.lineNumber,
			targetModuleId: resolved.targetModule!.id,
			targetMemory: memory,
		};
	}
	return slots;
}
