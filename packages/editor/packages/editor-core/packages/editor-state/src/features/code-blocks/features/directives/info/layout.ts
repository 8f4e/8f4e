import type { EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { matchEditorDirectives } from '../utils';
import { createInfoDirectiveData } from './data';
import { getInfoLayout } from './entries';
import { updateInfoPanel } from './resolve';

export default function registerInfoLayout(layout: EditorLayoutRegistry): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'info' }]).flatMap(directive => {
			const data = createInfoDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [{ data, panel: getInfoLayout(state, data.id) }] : [];
		});
		const minimumWidths = items
			.filter(({ panel }) => panel.maxEntryWidth > 0)
			.map(({ panel }) => panel.maxEntryWidth + codeBlock.lineNumberColumnWidth + 3);
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items
				.filter(item => item.panel.rowCount > 0)
				.map(({ data, panel }) => ({ sourceLineIndex: data.lineNumber, heightInRows: panel.rowCount })),
			minGridWidth: minimumWidths.length ? Math.max(...minimumWidths) : undefined,
		});
		codeBlock.widgets.infoPanels = [];
		for (const { data, panel } of items) updateInfoPanel(data, panel, codeBlock, state);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
