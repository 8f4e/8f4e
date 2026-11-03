import { mountDefaultEditor } from '@8f4e/editor-default';
import type { EditorWebMcpBridge } from '@8f4e/editor-webmcp';

const canvas = document.querySelector<HTMLCanvasElement>('#glcanvas');

if (!canvas) {
	throw new Error('Editor canvas not found');
}

const url = new URL(window.location.href);
const initialProjectUrl = url.searchParams.get('projectUrl') || undefined;
if (initialProjectUrl) {
	url.searchParams.delete('projectUrl');
	window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

canvas.focus({ preventScroll: true });
const editor = await mountDefaultEditor(canvas, {
	initialProjectUrl,
	storage: window.localStorage,
	storageNamespace: 'editor',
});
Object.assign(window, { state: editor.state });
let bridge: EditorWebMcpBridge | undefined;
let disposed = false;

import.meta.hot?.dispose(() => {
	disposed = true;
	bridge?.dispose();
	editor.dispose();
});

void import('@8f4e/editor-webmcp')
	.then(({ createEditorWebMcp }) => {
		if (disposed) return;
		bridge = createEditorWebMcp({ document, editor, getCompilerDiagnostics: editor.getCompilerDiagnostics });
		return bridge.ready;
	})
	.catch(error => console.error('Failed to load editor site tools:', error));
