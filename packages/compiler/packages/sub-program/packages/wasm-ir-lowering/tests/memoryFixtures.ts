import type {
	MemoryDefault,
	MemoryDefaults,
	MemoryLayoutPlan,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
} from '@8f4e/language-spec';
import { ALLOCATION_UNIT_BYTE_SIZE, ArgumentType, isArrayMemoryDeclarationInstructionName } from '@8f4e/language-spec';

function getAllocatedByteLength(allocationUnitCount: number): number {
	return Math.max(0, allocationUnitCount) * ALLOCATION_UNIT_BYTE_SIZE;
}

function getEndByteAddress(byteAddress: number, allocationUnitCount: number): number {
	return allocationUnitCount <= 0 ? byteAddress : byteAddress + allocationUnitCount * ALLOCATION_UNIT_BYTE_SIZE;
}

/**
 * Creates a planned memory declaration fixture.
 *
 * @param overrides - Required identity and byte-address fields plus fixture overrides.
 * @returns A declaration with layout and source.
 */
export function createMemory(
	overrides: Partial<PlannedMemoryDeclaration> & Pick<PlannedMemoryDeclaration, 'id' | 'byteAddress'>
): PlannedMemoryDeclaration {
	const numberOfElements = overrides.numberOfElements ?? 1;
	const elementWordSize = overrides.elementWordSize ?? ALLOCATION_UNIT_BYTE_SIZE;
	const elementByteLength = numberOfElements * elementWordSize;
	const declaration = {
		numberOfElements,
		elementWordSize,
		type: 'int' as const,
		allocationUnitCount: Math.ceil(elementByteLength / ALLOCATION_UNIT_BYTE_SIZE),
		allocationUnitAddress: overrides.byteAddress / ALLOCATION_UNIT_BYTE_SIZE,
		lineNumber: 0,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
	const identifier = {
		type: ArgumentType.IDENTIFIER,
		value: declaration.name ?? 'array',
		referenceKind: 'plain',
		scope: 'local',
	} as const;
	const location = { diagnosticSource: { kind: 'document' }, lineNumber: declaration.lineNumber } as const;
	const arrayInstruction = `${declaration.type}[]`;

	return {
		...declaration,
		source:
			declaration.source ??
			(declaration.numberOfElements !== 1 && isArrayMemoryDeclarationInstructionName(arrayInstruction)
				? {
						...location,
						instruction: arrayInstruction,
						arguments: [
							identifier,
							{ type: ArgumentType.LITERAL, value: declaration.numberOfElements, isInteger: true },
						],
					}
				: {
						...location,
						instruction: declaration.type,
						arguments: [
							declaration.name === undefined ? { type: ArgumentType.LITERAL, value: 0, isInteger: true } : identifier,
						],
					}),
		elementByteLength,
		allocatedByteLength: getAllocatedByteLength(declaration.allocationUnitCount),
		endByteAddress: declaration.byteAddress + elementByteLength,
	};
}

export function createMemoryDefault(
	value: MemoryDefault['value'],
	overrides: Partial<MemoryDefault> = {}
): MemoryDefault {
	return {
		value,
		hasExplicitDefault: false,
		...overrides,
	};
}

export function createMemoryPlan(
	memory: Record<string, PlannedMemoryDeclaration>,
	overrides: Partial<PlannedMemoryModule> = {}
): MemoryLayoutPlan {
	const declarations = Object.values(memory);
	const byteAddress = overrides.byteAddress ?? 0;
	const allocationUnitCount =
		overrides.allocationUnitCount ??
		declarations.reduce(
			(max, declaration) => Math.max(max, declaration.allocationUnitAddress + declaration.allocationUnitCount),
			0
		);
	const module: PlannedMemoryModule = {
		id: overrides.id ?? 'test',
		lineNumber: overrides.lineNumber ?? 0,
		byteAddress,
		allocationUnitCount,
		allocatedByteLength: getAllocatedByteLength(allocationUnitCount),
		endByteAddress: getEndByteAddress(byteAddress, allocationUnitCount),
		memory,
		declarations,
	};

	return {
		modules: {
			[module.id]: module,
		},
		moduleList: [module],
	};
}

export function createMemoryDefaults(defaults: MemoryDefaults): Record<string, MemoryDefaults> {
	return {
		test: defaults,
	};
}

/**
 * Converts memory data segments into plain arrays for stable test assertions.
 *
 * @param segments - Memory data segments to serialize.
 * @returns Serializable segment objects with byte arrays expanded.
 */
export function serializeSegments<T extends { byteAddress: number; bytes: Uint8Array }>(segments: T[]) {
	return segments.map(segment => ({
		byteAddress: segment.byteAddress,
		bytes: Array.from(segment.bytes),
	}));
}
