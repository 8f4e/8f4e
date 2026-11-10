import { hasConfig, hasDirective, type LazyEditorPlugin } from '@8f4e/editor-plugin-lazy-loader';

export function createLazyPluginRegistry({
	prefersReducedMotion,
	writeMemory,
	getMemory,
	getCodeBuffer,
}: {
	prefersReducedMotion: () => boolean;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
	getMemory: () => WebAssembly.Memory | null;
	getCodeBuffer: () => Uint8Array;
}): readonly LazyEditorPlugin[] {
	return [
		{
			id: 'watch',
			scope: 'view',
			matches: directives => ['watch', 'w'].some(name => hasDirective(directives, name)),
			load: () =>
				import('@8f4e/editor-plugin-watch').then(module => module.createWatchPlugin({ prefersReducedMotion })),
		},
		{
			id: 'stack',
			scope: 'view',
			matches: directives => ['stack', 's'].some(name => hasDirective(directives, name)),
			load: () =>
				import('@8f4e/editor-plugin-stack').then(module => module.createStackPlugin({ prefersReducedMotion })),
		},
		{
			id: 'plot',
			scope: 'view',
			matches: directives => hasDirective(directives, 'plot'),
			load: () => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin),
		},
		{
			id: 'slider',
			scope: 'view',
			matches: directives => hasDirective(directives, 'slider'),
			load: () => import('@8f4e/editor-plugin-slider').then(module => module.createSliderPlugin({ writeMemory })),
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
	];
}
