import { hasDirective, type LazyEditorPlugin } from '@8f4e/editor-plugin-lazy-loader';

export const lazyPlugins: readonly LazyEditorPlugin[] = [
	{
		id: 'plot',
		matches: project => hasDirective(project, 'plot'),
		load: () => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin),
	},
];
