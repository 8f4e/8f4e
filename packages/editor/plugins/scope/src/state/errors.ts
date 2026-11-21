import type { EditorPluginContext } from '@8f4e/editor-core';
import { matchEditorDirectives, parseFiniteNumber, walkProjectBlocks } from '@8f4e/editor-state';
import type { CodeError } from '@8f4e/editor-state-types';
import { MAX_SCOPE_SAMPLE_RATE_HZ } from '../helpers/data';

/** Report unsupported rates from source, independently of compiler readiness and widget layout. */
export function registerScopeErrors(store: EditorPluginContext['store']): () => void {
	const state = store.getState();
	const refresh = () => {
		const errors: CodeError[] = [];
		for (const block of walkProjectBlocks(state.codeBlockRendering.rootProject)) {
			for (const directive of matchEditorDirectives(block.parsedDirectives, [{ name: 'scope' }])) {
				const rate = parseFiniteNumber(directive.args[1]);
				if (rate === undefined || rate <= MAX_SCOPE_SAMPLE_RATE_HZ) continue;
				errors.push({
					codeBlockId: block.creationIndex,
					lineNumber: directive.sourceLineIndex,
					message: `@scope: sample rate must not exceed ${MAX_SCOPE_SAMPLE_RATE_HZ} Hz.`,
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
