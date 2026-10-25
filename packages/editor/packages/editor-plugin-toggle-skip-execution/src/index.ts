import { incrementCompilerInputRevision, setSkipExecution } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, EditorStatePlugin } from '@8f4e/editor-state-types';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';

const action = 'toggleModuleSkipExecutionDirective';

export const toggleSkipExecutionPlugin: EditorStatePlugin = {
	id: 'toggle-skip-execution',
	setup: ({ store, events, menus }) => {
		const onToggle = ({ codeBlock }: { codeBlock: CodeBlockGraphicData }) => {
			if (!store.getState().featureFlags.editing) return;

			const skipExecution = !codeBlock.code.some(line => isSkipExecutionDirective(line));
			const result = setSkipExecution(codeBlock.code, skipExecution);
			if (!result.changed) return;

			codeBlock.code = result.code;
			codeBlock.lastUpdated = Date.now();
			store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
			incrementCompilerInputRevision(store);
		};

		events.on(action, onToggle);
		const unregisterMenuItem = menus.registerItem('moduleMenu', ({ state, codeBlock }) => {
			if (!state.featureFlags.editing || codeBlock.blockType !== 'module') return;
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
