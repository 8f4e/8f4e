import type { EditorPlugin } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits, setSkipExecution } from '@8f4e/editor-state';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';

const action = 'toggleModuleSkipExecutionDirective';

export const toggleSkipExecutionPlugin: EditorPlugin = {
	id: 'toggle-skip-execution',
	setup: ({ store, events, menus }) => {
		const onToggle = ({ codeBlock }: { codeBlock: EditorCodeBlock }) => {
			if (store.getState().editorMode !== 'edit') return;

			const skipExecution = !codeBlock.code.some(line => isSkipExecutionDirective(line));
			const result = setSkipExecution(codeBlock.code, skipExecution);
			applyCodeBlockSourceEdits(store, [{ codeBlock, code: result.code }]);
		};

		events.on(action, onToggle);
		const unregisterMenuItem = menus.registerItem('codeBlockMenu', ({ state, codeBlock }) => {
			if (state.editorMode !== 'edit' || codeBlock.readOnly || codeBlock.blockType !== 'module') return;
			const skipped = codeBlock.code.some(line => isSkipExecutionDirective(line));
			return {
				title: skipped ? 'Unskip module' : 'Skip module',
				action,
				payload: { codeBlock },
				close: true,
			};
		});
		return () => {
			unregisterMenuItem();
			events.off(action, onToggle);
		};
	},
};
