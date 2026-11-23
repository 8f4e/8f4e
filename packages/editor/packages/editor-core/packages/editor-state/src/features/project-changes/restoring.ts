import type { ProjectChange, State } from '@8f4e/editor-state-types';

export const restoring = new WeakMap<State, Exclude<ProjectChange['kind'], 'edit'>>();

export function isRestoringProject(state: State): boolean {
	return restoring.has(state);
}

export function isRestoringProjectEdit(state: State): boolean {
	const kind = restoring.get(state);
	return kind === 'checkpoint' || kind === 'restore';
}
