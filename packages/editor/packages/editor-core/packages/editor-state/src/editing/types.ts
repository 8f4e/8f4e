export type EditorEdit =
	| { type: 'insert'; code: string[]; projectPath?: string; entry?: string }
	| { type: 'update'; blockId: string; code: string[]; entry?: string }
	| { type: 'delete'; blockId: string };

export interface EditorEditResult {
	revision: string;
	createdBlockIds: string[];
}

export interface EditorEditingHandle {
	/** Opaque project token for validating writes after reading editor.state. */
	getRevision(): string;
	applyEdits(request: { expectedRevision: string; edits: readonly EditorEdit[] }): EditorEditResult;
	undo(request: { expectedRevision: string }): { revision: string };
	redo(request: { expectedRevision: string }): { revision: string };
}

export interface EditorNavigationHandle {
	openGroup(blockId: string): void;
	goToParentGroup(): void;
	goToRoot(): void;
}

export class EditorEditingError extends Error {
	constructor(
		public readonly code: 'disposed' | 'read_only' | 'stale_revision' | 'invalid_edit' | 'block_not_found',
		message: string,
		public readonly revision?: string
	) {
		super(message);
		this.name = 'EditorEditingError';
	}
}
