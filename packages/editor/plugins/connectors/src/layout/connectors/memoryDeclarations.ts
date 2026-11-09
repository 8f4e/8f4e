import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

export function isInputMemoryDeclaration(memory: PlannedMemoryDeclaration): boolean {
	return memory.pointerDepth > 0;
}

export function isOutputMemoryDeclaration(memory: PlannedMemoryDeclaration): boolean {
	return memory.pointerDepth === 0 && !memory.name?.startsWith('_');
}
