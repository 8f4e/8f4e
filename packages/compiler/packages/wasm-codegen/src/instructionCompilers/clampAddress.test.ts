import { WASM_I32_LT_S, WASM_I32_LT_U, WASM_MEMORY_SIZE, WASM_SELECT } from '@8f4e/compiler-wasm-utils';
import type { ClampAddressLine, MemoryAddressRange } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import { clampAddress, clampGlobalAddress, clampModuleAddress } from './clampAddress';

const range: MemoryAddressRange = {
	source: 'memory-start',
	byteAddress: 0,
	safeByteLength: 128,
	memoryId: 'arr',
};

function createLine(
	instruction: 'clampAddress' | 'clampModuleAddress' | 'clampGlobalAddress',
	accessByteWidth?: number
): ClampAddressLine {
	return {
		lineNumber: 1,
		instruction,
		arguments:
			accessByteWidth === undefined ? [] : [{ type: ArgumentType.LITERAL, value: accessByteWidth, isInteger: true }],
	};
}

describe('clamp address instruction compilers', () => {
	it('clamps to tracked address range metadata using the global alignment boundary by default', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			clampAddress,
			createLine('clampAddress'),
			context,
			createStackFacts({
				clamp: {
					accessByteWidth: 4,
					range,
				},
			})
		);

		expect(context.byteCode).toContain(WASM_SELECT);
		expect(context.byteCode).not.toContain(WASM_MEMORY_SIZE);
	});

	it('emits a signed comparison for the lower range bound', () => {
		const context = createInstructionCompilerTestContext();
		const shiftedRange: MemoryAddressRange = {
			source: 'memory-start',
			byteAddress: 64,
			safeByteLength: 128,
			memoryId: 'arr',
		};

		compileInstructionForTest(
			clampAddress,
			createLine('clampAddress'),
			context,
			createStackFacts({
				clamp: {
					accessByteWidth: 4,
					range: shiftedRange,
				},
			})
		);

		expect(context.byteCode).toContain(WASM_I32_LT_S);
		expect(context.byteCode).not.toContain(WASM_I32_LT_U);
	});

	it('clamps to the current module range', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			clampModuleAddress,
			createLine('clampModuleAddress'),
			context,
			createStackFacts({
				clamp: {
					accessByteWidth: 4,
					range: { source: 'module-start', byteAddress: 64, safeByteLength: 32, moduleId: 'osc' },
				},
			})
		);

		expect(context.byteCode).toContain(WASM_SELECT);
		expect(context.byteCode).not.toContain(WASM_MEMORY_SIZE);
	});

	it('clamps to the full global memory range', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			clampGlobalAddress,
			createLine('clampGlobalAddress'),
			context,
			createStackFacts({ clamp: { accessByteWidth: 4 } })
		);

		expect(context.byteCode).toContain(WASM_MEMORY_SIZE);
		expect(context.byteCode).toContain(WASM_SELECT);
	});
});
