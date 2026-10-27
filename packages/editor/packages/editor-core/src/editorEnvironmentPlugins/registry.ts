import type { EditorEnvironmentPluginRegistryEntry } from './types';

export const editorEnvironmentPluginRegistry: EditorEnvironmentPluginRegistryEntry[] = [
	{
		id: 'keyboard-memory',
		editorDirectives: [],
		editorConfigPaths: ['keyboard'],
		load: () => import('./keyboardMemory/plugin'),
	},
	{
		id: 'midi',
		editorDirectives: [],
		editorConfigPaths: ['midi'],
		load: () => import('./midi/plugin'),
	},
];
