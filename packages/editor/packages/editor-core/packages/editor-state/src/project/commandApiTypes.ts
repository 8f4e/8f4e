import type { EditorHistoryAvailability } from '@8f4e/editor-state-types';

export type EditorEdit =
	| {
			type: 'insert';
			code: string[];
			/** Owning group handle from getEditorBlockId; omit to insert at the root. */
			groupBlockId?: string;
			entry?: string;
	  }
	| { type: 'update'; blockId: string; code: string[]; entry?: string }
	| { type: 'delete'; blockId: string };

export interface EditorEditResult {
	revision: string;
	createdBlockIds: string[];
}

export interface EditorEditingHandle {
	/** Opaque project token for validating writes after reading editor.state. */
	getRevision(): string;
	/** Read available history actions without editing or committing pending changes. */
	getHistoryAvailability(): EditorHistoryAvailability;
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
