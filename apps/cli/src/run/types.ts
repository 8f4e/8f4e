import type { MemoryLayoutPlan, PlannedMemoryDeclaration } from '@8f4e/language-spec';

export interface RuntimeRunner {
	initialize(): void;
	runCycles(count: number): void;
	read(id: string): number | number[];
	readBytes(id: string): Uint8Array;
	write(id: string, value: number | number[]): void;
	writeBytes(id: string, bytes: Uint8Array): void;
}

export interface ResolvedMemoryReference {
	key: string;
	moduleId: string;
	memoryId: string;
	data: PlannedMemoryDeclaration;
}

export interface MemoryLookup {
	resolve(id: string): ResolvedMemoryReference;
}

export interface CreateRuntimeRunnerOptions {
	compiledWasmBase64: string;
	memoryPlan: MemoryLayoutPlan;
	requiredMemoryBytes: number;
}
