import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import {
	getCodeBlockMemoryScope,
	prepareAddressedRead,
	prepareMemoryAccess,
	prepareNumericRead,
} from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry } from '@8f4e/editor-state-types';
import { createScopeDirectiveData } from '../helpers/data';
import type { Scope } from '../types';

const HEIGHT_IN_ROWS = 8;

export function registerScopeLayout(
	layout: EditorLayoutRegistry,
	scopesByBlock: WeakMap<CodeBlockGraphicData, Scope[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'scope' }]).flatMap(directive => {
			const data = createScopeDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items.map(data => ({
				sourceLineIndex: data.lineNumber,
				heightInRows: HEIGHT_IN_ROWS,
			})),
		});
		const previous = [...(scopesByBlock.get(codeBlock) ?? [])];
		const scopes: Scope[] = [];
		const memoryScope = getCodeBlockMemoryScope(codeBlock);
		const { hGrid, vGrid } = state.viewport;
		const x = (codeBlock.lineNumberColumnWidth + 2) * vGrid;
		const width = Math.max(1, Math.floor(codeBlock.width - x - vGrid));
		const rowsByDisplayRow = new Map<number, number>();
		const offsetsByDisplayRow = new Map<number, number>();
		for (const data of items) {
			const displayRow = codeBlock.displayModel.sourceLineIndexToDisplayRow[data.lineNumber];
			if (displayRow !== undefined)
				rowsByDisplayRow.set(displayRow, (rowsByDisplayRow.get(displayRow) ?? 0) + HEIGHT_IN_ROWS);
		}

		for (const data of items) {
			const displayRow = codeBlock.displayModel.sourceLineIndexToDisplayRow[data.lineNumber];
			if (displayRow === undefined) continue;
			const offset = offsetsByDisplayRow.get(displayRow) ?? 0;
			offsetsByDisplayRow.set(displayRow, offset + HEIGHT_IN_ROWS);
			const access = prepareMemoryAccess(state, memoryScope, data.memoryId);
			const read = access && (prepareAddressedRead(access) ?? prepareNumericRead(access));
			if (!read) continue;

			// Use the scope-owned rows at the end of the gap, also when directives share a source line.
			const otherRows = Math.max(0, (codeBlock.gaps.get(displayRow)?.size ?? 0) - rowsByDisplayRow.get(displayRow)!);
			const key = JSON.stringify([data.memoryId, data.sampleRate, read.address, read.spec.valueType]);
			const geometry = {
				key,
				x,
				y: (gapCalculator(displayRow, codeBlock.gaps) + 1 + otherRows + offset) * hGrid,
				width,
				height: hGrid * HEIGHT_IN_ROWS,
				minValue: data.minValueOverride ?? read.spec.minValue,
				maxValue: data.maxValueOverride ?? read.spec.maxValue,
				sampleRate: data.sampleRate,
				read,
			};
			const previousIndex = previous.findIndex(scope => scope.key === key);
			const scope =
				previousIndex === -1
					? { ...geometry, history: [] }
					: Object.assign(previous.splice(previousIndex, 1)[0], geometry);
			scope.history.splice(0, Math.max(0, scope.history.length - width));
			scopes.push(scope);
		}
		scopesByBlock.set(codeBlock, scopes);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
