import type { CodeBlockType } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';

export type EditorEdit =
	| { type: 'insert'; code: string[]; projectPath?: string; x?: number; y?: number; entry?: string }
	| { type: 'update'; blockId: string; code: string[]; entry?: string }
	| { type: 'move'; blockId: string; x: number; y: number }
	| { type: 'delete'; blockId: string };

export interface EditorBlockSnapshot {
	/** Opaque handle valid in this editor at the snapshot's revision. */
	blockId: string;
	projectPath: string;
	type: CodeBlockType | 'group' | 'project';
	name: string;
	code: string[];
	x: number;
	y: number;
	entry?: string;
}

export interface EditorProjectSnapshot {
	/** Opaque token: revisions from different editor instances cannot be interchanged. */
	revision: string;
	compilerInputRevision: number;
	project: ProjectObjectModel;
	blocks: EditorBlockSnapshot[];
	editable: boolean;
	canUndo: boolean;
	canRedo: boolean;
}

export interface EditorEditResult {
	revision: string;
	createdBlockIds: string[];
}

export interface EditorEditingHandle {
	getSnapshot(): EditorProjectSnapshot;
	applyEdits(request: { expectedRevision: string; edits: readonly EditorEdit[] }): EditorEditResult;
	undo(request: { expectedRevision: string }): EditorEditResult;
	redo(request: { expectedRevision: string }): EditorEditResult;
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
