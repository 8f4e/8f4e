import { hasDirective, type LazyEditorPlugin } from '@8f4e/editor-plugin-lazy-loader';

export function createLazyPlugins({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): readonly LazyEditorPlugin[] {
	return [
		{
			id: 'plot',
			matches: project => hasDirective(project, 'plot'),
			load: () => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin),
		},
		{
			id: 'wave',
			matches: project => ['wave', 'wave2', 'wave4'].some(name => hasDirective(project, name)),
			load: () => import('@8f4e/editor-plugin-wave').then(module => module.wavePlugin),
		},
		{
			id: 'meter',
			matches: project => hasDirective(project, 'meter'),
			load: () => import('@8f4e/editor-plugin-meter').then(module => module.meterPlugin),
		},
		{
			id: 'bars',
			matches: project => hasDirective(project, 'bars'),
			load: () => import('@8f4e/editor-plugin-bars').then(module => module.barsPlugin),
		},
		{
			id: 'switch',
			matches: project => hasDirective(project, 'switch'),
			load: () => import('@8f4e/editor-plugin-switch').then(module => module.createSwitchPlugin({ writeMemory })),
		},
		{
			id: 'button',
			matches: project => hasDirective(project, 'button'),
			load: () => import('@8f4e/editor-plugin-button').then(module => module.createButtonPlugin({ writeMemory })),
		},
		{
			id: 'piano',
			matches: project => hasDirective(project, 'piano'),
			load: () => import('@8f4e/editor-plugin-piano').then(module => module.createPianoPlugin({ writeMemory })),
		},
		{
			id: 'slider',
			matches: project => hasDirective(project, 'slider'),
			load: () => import('@8f4e/editor-plugin-slider').then(module => module.createSliderPlugin({ writeMemory })),
		},
		{
			id: 'crossfade',
			matches: project => hasDirective(project, 'crossfade'),
			load: () => import('@8f4e/editor-plugin-crossfade').then(module => module.createCrossfadePlugin({ writeMemory })),
		},
	];
}
