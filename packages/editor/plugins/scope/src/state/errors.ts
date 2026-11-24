import type { EditorPluginContext } from '@8f4e/editor-core';
import { walkProjectBlocks } from '@8f4e/editor-state';
import type { CodeError } from '@8f4e/editor-state-types';
import type { ScopeDirectiveReader } from '../helpers/data';

/** Report unsupported rates from source, independently of compiler readiness and widget layout. */
export function registerScopeErrors(
	store: EditorPluginContext['store'],
	readScopeDirectives: ScopeDirectiveReader
): () => void {
	const state = store.getState();
	const refresh = () => {
		const errors: CodeError[] = [];
		for (const block of walkProjectBlocks(state.project.rootLevel)) {
			for (const diagnostic of readScopeDirectives(block.parsedDirectives).diagnostics) {
				errors.push({
					codeBlockId: block.creationIndex,
					...diagnostic,
				});
			}
		}
		const previous = state.codeErrors.scope ?? [];
		if (
			errors.length !== previous.length ||
			errors.some(
				(error, index) =>
					error.codeBlockId !== previous[index].codeBlockId ||
					error.lineNumber !== previous[index].lineNumber ||
					error.message !== previous[index].message
			)
		)
			store.set('codeErrors.scope', errors);
	};
	store.subscribe('projectChange', refresh);
	refresh();

	return () => {
		store.unsubscribe('projectChange', refresh);
		if (state.codeErrors.scope === undefined) return;
		const errors = { ...state.codeErrors };
		delete errors.scope;
		store.set('codeErrors', errors);
	};
}
