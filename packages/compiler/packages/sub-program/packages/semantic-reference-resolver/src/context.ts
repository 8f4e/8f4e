import type { CompilationContext, ReferenceSlotMap, SourceLocalBinding } from '@8f4e/language-spec';

export interface ReferenceResolutionContext extends CompilationContext {
	referenceSlots?: ReferenceSlotMap;
	/** Default cap for subsequent loops, normalized into their resolved instructions. */
	loopCap?: number;
	bindings: SourceLocalBinding[];
	bindingsByName: Record<string, SourceLocalBinding>;
}
