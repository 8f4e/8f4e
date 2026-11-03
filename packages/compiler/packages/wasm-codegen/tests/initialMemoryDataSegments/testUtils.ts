import type {
	MemoryDefault,
	MemoryDefaults,
	MemoryLayoutPlan,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
} from '@8f4e/language-spec';
import { ALLOCATION_UNIT_BYTE_SIZE } from '@8f4e/language-spec';

function getAllocatedByteLength(allocationUnitCount: number): number {
	return Math.max(0, allocationUnitCount) * ALLOCATION_UNIT_BYTE_SIZE;
}

function getEndByteAddress(byteAddress: number, allocationUnitCount: number): number {
	return allocationUnitCount <= 0 ? byteAddress : byteAddress + (allocationUnitCount - 1) * ALLOCATION_UNIT_BYTE_SIZE;
}

function getEndAddressSafeByteLength(allocationUnitCount: number): number {
	return allocationUnitCount > 0 ? ALLOCATION_UNIT_BYTE_SIZE : 0;
}

/**
 * Creates a memory data structure fixture for initial memory segment tests.
 *
 * @param overrides - Required identity and byte-address fields plus fixture overrides.
 * @returns A complete data structure fixture.
 */
export function createMemory(
	overrides: Partial<PlannedMemoryDeclaration> & Pick<PlannedMemoryDeclaration, 'id' | 'byteAddress'>
): PlannedMemoryDeclaration {
	const declaration = {
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int' as const,
		allocationUnitCount: 1,
		allocationUnitAddress: overrides.byteAddress / 4,
		lineNumber: 0,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};

	return {
		...declaration,
		elementByteLength: declaration.numberOfElements * declaration.elementWordSize,
		allocatedByteLength: getAllocatedByteLength(declaration.allocationUnitCount),
		endByteAddress: getEndByteAddress(declaration.byteAddress, declaration.allocationUnitCount),
		endAddressSafeByteLength: getEndAddressSafeByteLength(declaration.allocationUnitCount),
	};
}

export function createMemoryDefault(
	value: MemoryDefault['value'],
	overrides: Partial<MemoryDefault> = {}
): MemoryDefault {
	return {
		value,
		hasExplicitDefault: false,
		isInherited: false,
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
		endAddressSafeByteLength: getEndAddressSafeByteLength(allocationUnitCount),
		memory,
		declarations,
		declarationSources: overrides.declarationSources ?? [],
	};

	return {
		modules: {
			[module.id]: module,
		},
		moduleList: [module],
	};
}

export function createMemoryDefaults(defaults: Record<string, MemoryDefault>): Record<string, MemoryDefaults> {
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
