import { describe, expect, it } from 'vitest';
import { mainMenu, moduleMenu } from '../../src/features/menu/menus';
import { createMockCodeBlock, createMockState } from '../../src/pureHelpers/testingUtils/testUtils';

describe('menus - clipboard callback disabled state', () => {
	describe('mainMenu', () => {
		it('should disable "Paste Code Block" when readClipboardText is not provided', () => {
			const mockState = createMockState({
				editorMode: 'edit',
				callbacks: { readClipboardText: undefined },
			});

			const menu = mainMenu(mockState);

			const pasteCodeBlockItem = menu.find(item => item.title === 'Paste Code Block');
			expect(pasteCodeBlockItem).toBeDefined();
			expect(pasteCodeBlockItem?.disabled).toBe(true);
		});

		it('should enable "Paste Code Block" when readClipboardText is provided', () => {
			const mockState = createMockState({
				editorMode: 'edit',
				callbacks: { readClipboardText: async () => 'test' },
			});

			const menu = mainMenu(mockState);

			const pasteCodeBlockItem = menu.find(item => item.title === 'Paste Code Block');
			expect(pasteCodeBlockItem).toBeDefined();
			expect(pasteCodeBlockItem?.disabled).toBe(false);
		});

		it('should not show "Paste Code Block" when editing is disabled', () => {
			const mockState = createMockState({
				featureFlags: { editing: false },
			});

			const menu = mainMenu(mockState);

			const pasteCodeBlockItem = menu.find(item => item.title === 'Paste Code Block');
			expect(pasteCodeBlockItem).toBeUndefined();
		});
	});

	describe('moduleMenu', () => {
		it('should disable "Copy" menu item when writeClipboardText is not provided', () => {
			const mockCodeBlock = createMockCodeBlock({ name: 'test', blockType: 'module' });
			const mockState = createMockState({
				callbacks: { writeClipboardText: undefined },
				codeBlockRendering: { selectedCodeBlock: mockCodeBlock },
			});

			const menu = moduleMenu(mockState, mockCodeBlock, []);

			const copyItem = menu.find(item => item.title === 'Copy module');
			expect(copyItem).toBeDefined();
			expect(copyItem?.disabled).toBe(true);
		});

		it('should enable "Copy" menu item when writeClipboardText is provided', () => {
			const mockCodeBlock = createMockCodeBlock({ name: 'test', blockType: 'module' });
			const mockState = createMockState({
				callbacks: { writeClipboardText: async () => {} },
				codeBlockRendering: { selectedCodeBlock: mockCodeBlock },
			});

			const menu = moduleMenu(mockState, mockCodeBlock, []);

			const copyItem = menu.find(item => item.title === 'Copy module');
			expect(copyItem).toBeDefined();
			expect(copyItem?.disabled).toBe(false);
		});

		it('should show correct label for function block type', () => {
			const mockCodeBlock = createMockCodeBlock({ name: 'test', blockType: 'function' });
			const mockState = createMockState({
				callbacks: { writeClipboardText: undefined },
				codeBlockRendering: { selectedCodeBlock: mockCodeBlock },
			});

			const menu = moduleMenu(mockState, mockCodeBlock, []);

			const copyItem = menu.find(item => item.title === 'Copy function');
			expect(copyItem).toBeDefined();
			expect(copyItem?.disabled).toBe(true);
		});

		it('should show correct label for note block type', () => {
			const mockCodeBlock = createMockCodeBlock({ name: 'test', blockType: 'note' });
			const mockState = createMockState({
				callbacks: { writeClipboardText: undefined },
				codeBlockRendering: { selectedCodeBlock: mockCodeBlock },
			});

			const menu = moduleMenu(mockState, mockCodeBlock, []);

			const copyItem = menu.find(item => item.title === 'Copy note');
			expect(copyItem).toBeDefined();
			expect(copyItem?.disabled).toBe(true);
		});
	});
});
