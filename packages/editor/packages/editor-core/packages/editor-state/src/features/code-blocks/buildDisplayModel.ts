import type { BuildDisplayModelOptions, CodeBlockDisplayModel, DisplayLine } from '@8f4e/editor-state-types';

function getVisibleSourceLineIndices(
	code: string[],
	hideAfterSourceLineIndex: number | undefined,
	isExpandedForEditing: boolean
): number[] {
	if (hideAfterSourceLineIndex === undefined || isExpandedForEditing) {
		return code.map((_, sourceLineIndex) => sourceLineIndex);
	}

	return code.flatMap((_, sourceLineIndex) => {
		if (sourceLineIndex <= hideAfterSourceLineIndex) {
			return [sourceLineIndex];
		}

		return [];
	});
}

function shouldShowCollapsedPlaceholder(
	code: string[],
	hideAfterSourceLineIndex: number | undefined,
	isExpandedForEditing: boolean
): hideAfterSourceLineIndex is number {
	return hideAfterSourceLineIndex !== undefined && !isExpandedForEditing && hideAfterSourceLineIndex < code.length - 1;
}

export default function buildDisplayModel(
	code: string[],
	{ hideAfterSourceLineIndex, isExpandedForEditing = false }: BuildDisplayModelOptions = {}
): CodeBlockDisplayModel {
	const visibleSourceLineIndices = getVisibleSourceLineIndices(code, hideAfterSourceLineIndex, isExpandedForEditing);
	const lines: DisplayLine[] = visibleSourceLineIndices.map(sourceLineIndex => ({
		sourceLineIndex,
		text: code[sourceLineIndex] || '',
	}));

	if (shouldShowCollapsedPlaceholder(code, hideAfterSourceLineIndex, isExpandedForEditing)) {
		lines.push({
			sourceLineIndex: hideAfterSourceLineIndex,
			text: '...',
			isPlaceholder: true,
		});
	}

	const displayRowToSourceLineIndex = lines.map(line => line.sourceLineIndex);
	const sourceLineIndexToDisplayRow = code.map(() => undefined as number | undefined);
	lines.forEach((line, displayRow) => {
		sourceLineIndexToDisplayRow[line.sourceLineIndex] = displayRow;
	});

	return {
		lines,
		displayRowToSourceLineIndex,
		sourceLineIndexToDisplayRow,
		isCollapsed: hideAfterSourceLineIndex !== undefined && !isExpandedForEditing,
	};
}
