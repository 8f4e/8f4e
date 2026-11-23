import type { ProjectEntryName, ProjectGroupPath } from '@8f4e/language-spec';

/** Detached editor source, including the retained facts of incomplete declarations. */
export interface EditorBlockSnapshot {
	readonly creationIndex: number;
	readonly code: readonly string[];
	readonly entry?: ProjectEntryName;
	readonly gridX: number;
	readonly gridY: number;
	readonly isProjectScope: boolean;
	readonly childProject?: EditorLevelSnapshot;
}

export interface EditorLevelSnapshot {
	readonly path: ProjectGroupPath;
	readonly entries: readonly ProjectEntryName[];
	readonly blocks: readonly EditorBlockSnapshot[];
}

/** Editor source with editable block boundaries and metadata, not the compiler projection or derived layout. */
export interface EditorProjectSnapshot {
	readonly rootProject: EditorLevelSnapshot;
	readonly environmentId?: number;
	readonly nextCodeBlockCreationIndex: number;
}
