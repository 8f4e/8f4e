import { incrementCompilerInputRevision, setSkipExecution } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, EditorStatePlugin } from '@8f4e/editor-state-types';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';

const action = 'toggleModuleSkipExecutionDirective';

export const toggleSkipExecutionPlugin: EditorStatePlugin = {
	id: 'toggle-skip-execution',
	actions: [action],
	setup: ({ store, events }) => {
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
		return () => events.off(action, onToggle);
	},
};
