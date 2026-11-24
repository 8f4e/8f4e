import type { EditorPluginContext } from '@8f4e/editor-core';

export function registerExportActions(
	{ events, menus }: EditorPluginContext,
	inputTarget: HTMLElement,
	onExport: () => void | Promise<void>,
	shortcutAction: 'saveProject' | 'exportProject'
): () => void {
	const unregister = menus.registerItem('mainMenu', () => ({
		title: 'Export Project',
		action: 'exportProject',
		close: true,
	}));
	const onKeydown = (event: KeyboardEvent) => {
		if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
		event.preventDefault();
		events.dispatch(shortcutAction);
	};
	events.on('exportProject', onExport);
	inputTarget.addEventListener('keydown', onKeydown);
	return () => {
		events.off('exportProject', onExport);
		inputTarget.removeEventListener('keydown', onKeydown);
		unregister();
	};
}
