import type { EditorCodeBlock, EditorPlugin } from '@8f4e/editor-core';

const action = 'logBlockInfo';

export const logBlockInfoPlugin: EditorPlugin = {
	id: 'log-block-info',
	setup: ({ events, menus }) => {
		const onLog = ({ codeBlock }: { codeBlock: EditorCodeBlock }) => {
			console.log(codeBlock);
		};
		events.on(action, onLog);
		const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ codeBlock }) => {
			const label = codeBlock.childLevel ? 'group' : codeBlock.blockType;
			return {
				title: `Log ${label} info to console`,
				action,
				payload: { codeBlock },
				close: true,
			};
		});
		return () => {
			unregisterMenuItem();
			events.off(action, onLog);
		};
	},
};
