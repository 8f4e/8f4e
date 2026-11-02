import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

export function isInputMemoryDeclaration(memory: PlannedMemoryDeclaration): boolean {
	return memory.pointerDepth > 0;
}

function isPrivateOutputId(id: string): boolean {
	return id.startsWith('_') && !id.startsWith('__anonymous__');
}

export function isOutputMemoryDeclaration(memory: PlannedMemoryDeclaration): boolean {
	return memory.pointerDepth === 0 && !isPrivateOutputId(memory.id);
}
