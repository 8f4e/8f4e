import type { CompilerASTLine, MemoryAddressRange, PlannedMemoryModule } from '@8f4e/language-spec';
import { ALLOCATION_UNIT_BYTE_SIZE, ArgumentType, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

const range: MemoryAddressRange = {
	source: 'memory-start',
	byteAddress: 0,
	safeByteLength: 128,
	memoryId: 'arr',
};

function createPlannedModule(overrides: Partial<PlannedMemoryModule> = {}): PlannedMemoryModule {
	const byteAddress = overrides.byteAddress ?? 0;
	const allocationUnitCount = overrides.allocationUnitCount ?? 0;
	return {
		id: overrides.id ?? 'test',
		lineNumber: overrides.lineNumber ?? 0,
		byteAddress,
		allocationUnitCount,
		allocatedByteLength: allocationUnitCount * ALLOCATION_UNIT_BYTE_SIZE,
		endByteAddress:
			allocationUnitCount > 0 ? byteAddress + (allocationUnitCount - 1) * ALLOCATION_UNIT_BYTE_SIZE : byteAddress,
		endAddressSafeByteLength: allocationUnitCount > 0 ? ALLOCATION_UNIT_BYTE_SIZE : 0,
		memory: overrides.memory ?? {},
		declarations: overrides.declarations ?? [],
		declarationSources: overrides.declarationSources ?? [],
	};
}

function createLine(
	instruction: 'clampAddress' | 'clampModuleAddress' | 'clampGlobalAddress',
	accessByteWidth?: number
) {
	return {
		lineNumber: 1,
		instruction,
		arguments:
			accessByteWidth === undefined ? [] : [{ type: ArgumentType.LITERAL, value: accessByteWidth, isInteger: true }],
	} as CompilerASTLine;
}
describe('clampAddress stack analysis', () => {
	it('clamps to tracked address range metadata using the global alignment boundary by default', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			isNonZero: true,
			knownValue: 1024,
			address: { clampRange: range },
		});

		analyzeInstruction(createLine('clampAddress'), context);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 128 - ALLOCATION_UNIT_BYTE_SIZE,
				address: {
					clampRange: range,
					safeAccessByteWidth: ALLOCATION_UNIT_BYTE_SIZE,
				},
			},
		]);
	});

	it('uses the optional access width when clamping to tracked address range metadata', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			isNonZero: true,
			knownValue: 1024,
			address: { clampRange: range },
		});

		analyzeInstruction(createLine('clampAddress', 1), context);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 127,
				address: {
					clampRange: range,
					safeAccessByteWidth: 1,
				},
			},
		]);
	});

	it('clamps known negative addresses to the lower range bound', () => {
		const context = createStackAnalyzerTestContext();
		const shiftedRange: MemoryAddressRange = {
			source: 'memory-start',
			byteAddress: 64,
			safeByteLength: 128,
			memoryId: 'arr',
		};
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			isNonZero: true,
			knownValue: -1,
			address: { clampRange: shiftedRange },
		});

		analyzeInstruction(createLine('clampAddress'), context);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 64,
				address: {
					clampRange: shiftedRange,
					safeAccessByteWidth: ALLOCATION_UNIT_BYTE_SIZE,
				},
			},
		]);
	});

	it('throws when clampAddress has no address range metadata', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'int', isNonZero: false });

		expect(() => analyzeInstruction(createLine('clampAddress'), context)).toThrow(
			expect.objectContaining({ code: ErrorCode.ADDRESS_RANGE_REQUIRED })
		);
	});

	it('clamps to the current module range', () => {
		const plannedModule = createPlannedModule({
			id: 'osc',
			byteAddress: 64,
			allocationUnitCount: 8,
		});
		const context = createStackAnalyzerTestContext({
			currentPlannedModule: plannedModule,
			namespace: {
				...createStackAnalyzerTestContext().namespace,
				moduleName: 'osc',
			},
		});
		context.stack.push({ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 999 });

		analyzeInstruction(createLine('clampModuleAddress'), context);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: true,
				knownValue: 92,
				address: {
					clampRange: {
						source: 'module-start',
						byteAddress: 64,
						safeByteLength: 32,
						moduleId: 'osc',
					},
					safeAccessByteWidth: ALLOCATION_UNIT_BYTE_SIZE,
				},
			},
		]);
	});

	it('clamps to the full global memory range', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 1024 });

		analyzeInstruction(createLine('clampGlobalAddress'), context);

		expect(context.stack).toEqual([
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {
					safeAccessByteWidth: ALLOCATION_UNIT_BYTE_SIZE,
				},
			},
		]);
	});

	it('rejects access widths larger than the tracked range', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			isNonZero: false,
			address: {
				clampRange: { source: 'memory-start', byteAddress: 0, safeByteLength: 2, memoryId: 'tiny' },
			},
		});

		expect(() => analyzeInstruction(createLine('clampAddress'), context)).toThrow(
			expect.objectContaining({ code: ErrorCode.ADDRESS_RANGE_TOO_SMALL })
		);
	});
});
