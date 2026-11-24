import type { ProjectEntryName, ProjectGroupPath } from '@8f4e/language-spec';

/** Detached editor source, including the retained facts of incomplete declarations. */
export interface EditorBlockSnapshot {
	readonly creationIndex: number;
	readonly code: readonly string[];
	readonly entry?: ProjectEntryName;
	readonly gridX: number;
	readonly gridY: number;
	readonly isProjectScope: boolean;
	readonly childLevel?: EditorLevelSnapshot;
}

export interface EditorLevelSnapshot {
	readonly path: ProjectGroupPath;
	readonly entries: readonly ProjectEntryName[];
	readonly blocks: readonly EditorBlockSnapshot[];
}

/** Authored editor source with editable block boundaries and metadata, excluding the managed environment and derived layout. */
export interface EditorProjectSnapshot {
	readonly rootLevel: EditorLevelSnapshot;
	readonly nextCodeBlockCreationIndex: number;
}
