import type { BlockStack, CompilationContext } from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { popBlock, pushBlock } from './blockStack';
import { createCompilationContext } from './createCompilationContext';

function createBlockStackTestContext(overrides: Partial<CompilationContext> = {}): CompilationContext {
	return createCompilationContext({
		...overrides,
		namespace: {
			moduleName: 'test',
			...overrides.namespace,
		},
	});
}

describe('blockStack utilities', () => {
	const mockModuleBlock: BlockStack[number] = {
		blockType: BlockType.MODULE,
		expectedResultTypes: [],
	};
	const mockFunctionBlock: BlockStack[number] = {
		blockType: BlockType.FUNCTION,
		expectedResultTypes: [],
	};
	const mockLoopBlock: BlockStack[number] = {
		blockType: BlockType.LOOP,
		expectedResultTypes: [],
	};
	const mockGenericBlock: BlockStack[number] = {
		blockType: BlockType.BLOCK,
		expectedResultTypes: [],
	};
	const mockConditionBlock: BlockStack[number] = {
		blockType: BlockType.CONDITION,
		expectedResultTypes: [],
	};
	const mockConstantsBlock: BlockStack[number] = {
		blockType: BlockType.CONSTANTS,
		expectedResultTypes: [],
	};
	const mockMapBlock: BlockStack[number] = {
		blockType: BlockType.MAP,
		expectedResultTypes: [],
		mapState: {
			inputIsInteger: true,
			inputIsFloat64: false,
			rows: [],
			defaultSet: false,
		},
	};

	describe('pushBlock and popBlock', () => {
		it.each([
			['module', mockModuleBlock],
			['function', mockFunctionBlock],
			['generic', mockGenericBlock],
			['loop', mockLoopBlock],
			['condition', mockConditionBlock],
			['constants', mockConstantsBlock],
			['map', mockMapBlock],
		] as const)('pushes and pops %s blocks', (_name, block) => {
			const context = createBlockStackTestContext({ blockStack: [] });

			pushBlock(context, block);

			expect(context.blockStack).toEqual([block]);

			expect(popBlock(context)).toEqual(block);
			expect(context.blockStack).toEqual([]);
		});

		it('tracks active loop blocks without scanning the block stack', () => {
			const context = createBlockStackTestContext({ blockStack: [] });
			const outerLoopBlock: typeof mockLoopBlock = {
				...mockLoopBlock,
			};
			const innerLoopBlock: typeof mockLoopBlock = {
				...mockLoopBlock,
			};

			pushBlock(context, outerLoopBlock);
			pushBlock(context, mockGenericBlock);
			pushBlock(context, innerLoopBlock);

			expect(context.activeLoopBlocks).toEqual([outerLoopBlock, innerLoopBlock]);

			expect(popBlock(context)).toBe(innerLoopBlock);
			expect(context.activeLoopBlocks).toEqual([outerLoopBlock]);

			expect(popBlock(context)).toBe(mockGenericBlock);
			expect(context.activeLoopBlocks).toEqual([outerLoopBlock]);

			expect(popBlock(context)).toBe(outerLoopBlock);
			expect(context.activeLoopBlocks).toEqual([]);
		});

		it('tracks the active non-nestable map block directly', () => {
			const context = createBlockStackTestContext({ blockStack: [] });

			pushBlock(context, mockMapBlock);

			expect(context.activeMapBlock).toBe(mockMapBlock);

			expect(popBlock(context)).toBe(mockMapBlock);
			expect(context.activeMapBlock).toBeUndefined();
		});
	});

	it('derives active loop and map blocks from a seeded stack', () => {
		const outerLoopBlock = { ...mockLoopBlock };
		const innerLoopBlock = { ...mockLoopBlock };
		const blockStack = [mockModuleBlock, outerLoopBlock, mockGenericBlock, innerLoopBlock, mockMapBlock];
		const context = createBlockStackTestContext({ blockStack });

		expect(context.blockStack).toEqual(blockStack);
		expect(context.activeLoopBlocks).toEqual([outerLoopBlock, innerLoopBlock]);
		expect(context.activeMapBlock).toBe(mockMapBlock);

		expect(popBlock(context)).toBe(mockMapBlock);
		expect(context.activeMapBlock).toBeUndefined();
		expect(context.activeLoopBlocks).toEqual([outerLoopBlock, innerLoopBlock]);

		expect(popBlock(context)).toBe(innerLoopBlock);
		expect(context.activeLoopBlocks).toEqual([outerLoopBlock]);
		expect(context.blockStack).toEqual([mockModuleBlock, outerLoopBlock, mockGenericBlock]);
	});
});
