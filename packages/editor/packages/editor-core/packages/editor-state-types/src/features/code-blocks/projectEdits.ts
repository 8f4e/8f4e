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

/** Final intended changes to the attached project tree. Internal callers supply coherent, attached targets. */
export interface ProjectEditPlan {
	updates?: readonly { codeBlock: CodeBlockGraphicData; code?: readonly string[]; entry?: string }[];
	inserts?: readonly { project: ProjectLevel; source: ProjectSourceBlock }[];
	deletes?: readonly CodeBlockGraphicData[];
}

export interface ProjectEditResult {
	changed: boolean;
	/** Newly attached top-level blocks, in insertion order. */
	insertedBlocks: CodeBlockGraphicData[];
}

/** Synchronous project mutation and settlement. Callers own edit-mode policy; the compiler validates the source. */
export interface ProjectEdits {
	apply(plan: ProjectEditPlan, kind?: 'edit' | 'checkpoint'): ProjectEditResult;
	/** Restore configuration from authored project source after a temporary override. */
	refreshConfig(): void;
}
