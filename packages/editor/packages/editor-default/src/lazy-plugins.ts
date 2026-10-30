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
			scope: 'view',
			matches: directives => hasDirective(directives, 'plot'),
			load: () => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin),
		},
		{
			id: 'wave',
			scope: 'view',
			matches: directives => ['wave', 'wave2', 'wave4'].some(name => hasDirective(directives, name)),
			load: () => import('@8f4e/editor-plugin-wave').then(module => module.wavePlugin),
		},
		{
			id: 'meter',
			scope: 'view',
			matches: directives => hasDirective(directives, 'meter'),
			load: () => import('@8f4e/editor-plugin-meter').then(module => module.meterPlugin),
		},
		{
			id: 'bars',
			scope: 'view',
			matches: directives => hasDirective(directives, 'bars'),
			load: () => import('@8f4e/editor-plugin-bars').then(module => module.barsPlugin),
		},
		{
			id: 'switch',
			scope: 'view',
			matches: directives => hasDirective(directives, 'switch'),
			load: () => import('@8f4e/editor-plugin-switch').then(module => module.createSwitchPlugin({ writeMemory })),
		},
		{
			id: 'button',
			scope: 'view',
			matches: directives => hasDirective(directives, 'button'),
			load: () => import('@8f4e/editor-plugin-button').then(module => module.createButtonPlugin({ writeMemory })),
		},
		{
			id: 'piano',
			scope: 'view',
			matches: directives => hasDirective(directives, 'piano'),
			load: () => import('@8f4e/editor-plugin-piano').then(module => module.createPianoPlugin({ writeMemory })),
		},
		{
			id: 'slider',
			scope: 'view',
			matches: directives => hasDirective(directives, 'slider'),
			load: () => import('@8f4e/editor-plugin-slider').then(module => module.createSliderPlugin({ writeMemory })),
		},
		{
			id: 'crossfade',
			scope: 'view',
			matches: directives => hasDirective(directives, 'crossfade'),
			load: () => import('@8f4e/editor-plugin-crossfade').then(module => module.createCrossfadePlugin({ writeMemory })),
		},

		{
			id: 'midi-input',
			scope: 'project',
			matches: directives => hasConfig(directives, 'midi'),
			load: () =>
				import('@8f4e/editor-plugin-midi-input').then(module =>
					module.createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })
				),
		},
		{
			id: 'binary-assets',
			scope: 'project',
			matches: directives => hasConfig(directives, 'bin'),
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
			id: 'texture-runtime',
			scope: 'project',
			matches: directives => hasConfig(directives, 'textureRuntime') || hasDirective(directives, 'texture'),
			load: () =>
				import('@8f4e/editor-plugin-texture-runtime').then(module =>
					module.createTextureRuntimePlugin({ getCodeBuffer, getMemory })
				),
		},
		{
			id: 'worker-runtime',
			scope: 'project',
			matches: directives => hasConfig(directives, 'workerRuntime'),
			load: () =>
				import('@8f4e/editor-plugin-worker-runtime').then(module =>
					module.createWorkerRuntimePlugin({ getCodeBuffer, getMemory })
				),
		},
		{
			id: 'audio-runtime',
			scope: 'project',
			matches: directives => hasConfig(directives, 'audioRuntime'),
			load: () =>
				import('@8f4e/editor-plugin-audio-runtime').then(module =>
					module.createAudioRuntimePlugin({ getCodeBuffer, getMemory, sharedAudioContext })
				),
		},
		{
			id: 'test-runtime',
			scope: 'project',
			matches: directives => hasConfig(directives, 'testRuntime'),
			load: () =>
				import('@8f4e/editor-plugin-test-runtime').then(module =>
					module.createTestRuntimePlugin({ getCodeBuffer, getMemory, getAssertionSites })
				),
		},
	];
}
