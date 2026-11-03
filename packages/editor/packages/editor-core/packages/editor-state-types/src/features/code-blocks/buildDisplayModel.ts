export interface DisplayLine {
	sourceLineIndex: number;
	text: string;
	isPlaceholder?: boolean;
}

export interface CodeBlockDisplayModel {
	lines: DisplayLine[];
	displayRowToSourceLineIndex: number[];
	sourceLineIndexToDisplayRow: Array<number | undefined>;
	isCollapsed: boolean;
}

export interface BuildDisplayModelOptions {
	hideAfterSourceLineIndex?: number;
	isExpandedForEditing?: boolean;
}
