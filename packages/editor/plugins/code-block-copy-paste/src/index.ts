import type { EditorPlugin } from '@8f4e/editor-core';
import { insertCodeBlocks, type SerializedCodeBlock, serializeCodeBlocks } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

function parseBlockSources(text: string): SerializedCodeBlock[] | undefined {
	try {
		const value = JSON.parse(text);
		if (Array.isArray(value)) return value;
	} catch {
		// Plain source is the other supported block-copy format.
	}
}

export function createCodeBlockCopyPastePlugin({
	readClipboardText,
	writeClipboardText,
}: {
	readClipboardText: () => Promise<string>;
	writeClipboardText: (text: string) => Promise<void>;
}): EditorPlugin {
	return {
		id: 'code-block-copy-paste',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const onCopy = async ({ codeBlock }: { codeBlock: CodeBlockGraphicData }) => {
				const text = codeBlock.childProject
					? JSON.stringify(serializeCodeBlocks([codeBlock], codeBlock))
					: codeBlock.code.join('\n');
				await writeClipboardText(text);
			};
			const onPaste = async ({ x, y }: { x: number; y: number }) => {
				if (state.editorMode !== 'edit') return;
				const text = await readClipboardText();
				const blocks = parseBlockSources(text) ?? [{ code: text.split(/\r\n?|\n/), gridCoordinates: { x: 0, y: 0 } }];
				insertCodeBlocks(store, { x, y, blocks });
			};
			const removePasteMenu = menus.registerItem('mainMenu', () => {
				if (state.editorMode !== 'edit') return;
				return { title: 'Paste Code Block', action: 'pasteCodeBlocks', close: true };
			});
			const removeCopyMenu = menus.registerItem('moduleMenu', ({ codeBlock }) => ({
				title: `Copy ${codeBlock.childProject ? 'group' : codeBlock.blockType}`,
				action: 'copyCodeBlock',
				payload: { codeBlock },
				close: true,
			}));
			events.on('copyCodeBlock', onCopy);
			events.on('pasteCodeBlocks', onPaste);
			return () => {
				events.off('copyCodeBlock', onCopy);
				events.off('pasteCodeBlocks', onPaste);
				removeCopyMenu();
				removePasteMenu();
			};
		},
	};
}
