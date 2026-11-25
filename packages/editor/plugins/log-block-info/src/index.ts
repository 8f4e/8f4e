import type { EditorPlugin } from '@8f4e/editor-core';

const action = 'consoleLog';

export const logBlockInfoPlugin: EditorPlugin = {
	id: 'log-block-info',
	setup: ({ events, menus }) => {
		const onLog = (event: unknown) => {
			console.log(event);
		};
		events.on(action, onLog);
		const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ codeBlock }) => {
			const label = codeBlock.childLevel ? 'group' : codeBlock.isProjectScope ? 'project' : codeBlock.blockType;
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
