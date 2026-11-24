import type { CodeBlockGraphicData, ProjectLevel } from './types';

/** Source for an inserted block, independent of its eventual pixel layout. Positions belong in source directives. */
export interface ProjectSourceBlock {
	code: readonly string[];
	entry?: string;
	childProject?: {
		entries: readonly string[];
		blocks: readonly ProjectSourceBlock[];
	};
}

/** Final intended changes to the attached project tree. Callers supply attached targets; read-only writes and attempts to create the reserved root environment are ignored. */
export interface ProjectEditPlan {
	updates?: readonly {
		codeBlock: CodeBlockGraphicData;
		code?: readonly string[];
		/** Requested execution entry, applicable to modules and project groups in the settled source. */
		entry?: string;
	}[];
	inserts?: readonly { project: ProjectLevel; source: ProjectSourceBlock }[];
	/** Repeated deletes and deletes covered by an ancestor deletion are idempotent. */
	deletes?: readonly CodeBlockGraphicData[];
}

export interface ProjectEditResult {
	changed: boolean;
	/** Newly attached top-level blocks, in insertion order. */
	insertedBlocks: CodeBlockGraphicData[];
}

export interface ProjectEditOptions {
	/** Group edits into a typing burst by default, or record one immediate undo step. */
	history?: 'debounced' | 'checkpoint';
}

/** Synchronous project mutation and settlement. Callers own edit-mode policy; the compiler validates the source. */
export interface ProjectEdits {
	apply(plan: ProjectEditPlan, options?: ProjectEditOptions): ProjectEditResult;
}
