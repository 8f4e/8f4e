import { getExportBaseName, logError, serializeToProject } from '@8f4e/editor-state';
import type { State } from '@8f4e/editor-state-types';
import { serializeProjectTo8f4e } from './serializeTo8f4e';

export interface ProjectSourceFile {
	blob: Blob;
	fileName: string;
}

/** Capture the current root project before opening a picker or queuing a write. */
export function createProjectSourceFile(state: State): ProjectSourceFile | undefined {
	try {
		const text = serializeProjectTo8f4e(serializeToProject(state));
		return {
			blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
			fileName: `${getExportBaseName(state)}.8f4e`,
		};
	} catch (error) {
		logError(state, `Failed to serialize project: ${String(error)}`);
	}
}
