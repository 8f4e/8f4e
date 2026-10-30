import { hasConfig, hasDirective, type LazyEditorPlugin } from '@8f4e/editor-plugin-lazy-loader';

export function createLazyPluginRegistry({
	navigator,
	writeMemory,
	getMemory,
	getCodeBuffer,
	getAssertionSites,
	sharedAudioContext,
}: {
	navigator: Navigator;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
	getMemory: () => WebAssembly.Memory | null;
	getCodeBuffer: () => Uint8Array;
	getAssertionSites: () => import('@8f4e/language-spec').AssertionSite[] | undefined;
	sharedAudioContext?: AudioContext;
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

		{
			id: 'midi-input',
			matches: project => hasConfig(project, 'midi'),
			load: () =>
				import('@8f4e/editor-plugin-midi-input').then(module =>
					module.createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })
				),
		},
		{
			id: 'binary-assets',
			matches: project => hasConfig(project, 'bin'),
			load: () =>
				import('@8f4e/editor-plugin-binary-assets').then(module =>
					module.createBinaryAssetsPlugin({
						getMemoryBytes: () => {
							const memory = getMemory();
							return memory ? new Uint8Array(memory.buffer) : undefined;
						},
					})
				),
		},

		{
			id: 'worker-runtime',
			matches: project => hasConfig(project, 'workerRuntime'),
			load: () =>
				import('@8f4e/editor-plugin-worker-runtime').then(module =>
					module.createWorkerRuntimePlugin({ getCodeBuffer, getMemory })
				),
		},
		{
			id: 'audio-runtime',
			matches: project => hasConfig(project, 'audioRuntime'),
			load: () =>
				import('@8f4e/editor-plugin-audio-runtime').then(module =>
					module.createAudioRuntimePlugin({ getCodeBuffer, getMemory, sharedAudioContext })
				),
		},
		{
			id: 'test-runtime',
			matches: project => hasConfig(project, 'testRuntime'),
			load: () =>
				import('@8f4e/editor-plugin-test-runtime').then(module =>
					module.createTestRuntimePlugin({ getCodeBuffer, getMemory, getAssertionSites })
				),
		},
	];
}
