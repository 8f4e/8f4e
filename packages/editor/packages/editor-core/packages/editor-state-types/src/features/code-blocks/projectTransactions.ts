import type { EditorCodeBlock, ProjectLevel } from './types';

/** Source for an inserted block, independent of its eventual pixel layout. Positions belong in source directives. */
export interface ProjectSourceBlock {
	code: readonly string[];
	entry?: string;
	childLevel?: {
		entries: readonly string[];
		blocks: readonly ProjectSourceBlock[];
	};
}

/** Final intended changes to the attached project tree. Callers supply attached targets; read-only writes and attempts to create the reserved root environment are ignored. */
export interface ProjectEditPlan {
	updates?: readonly {
		codeBlock: EditorCodeBlock;
		code?: readonly string[];
		/** Requested execution entry, applicable to modules and project groups in the settled source. */
		entry?: string;
	}[];
	inserts?: readonly { targetLevel: ProjectLevel; source: ProjectSourceBlock }[];
	/** Repeated deletes and deletes covered by an ancestor deletion are idempotent. */
	deletes?: readonly EditorCodeBlock[];
}

export interface ProjectEditResult {
	changed: boolean;
	/** Newly attached top-level blocks, in insertion order. */
	insertedBlocks: EditorCodeBlock[];
}

export interface ProjectEditOptions {
	/** Group edits into a typing burst by default, or record one immediate undo step. */
	history?: 'debounced' | 'checkpoint';
}

/** Synchronous project mutation and settlement. Callers own edit-mode policy; the compiler validates the source. */
export interface ProjectTransactions {
	apply(plan: ProjectEditPlan, options?: ProjectEditOptions): ProjectEditResult;
}
