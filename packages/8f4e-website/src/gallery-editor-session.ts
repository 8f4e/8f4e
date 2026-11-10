import { type GalleryEditorInstance, mountGalleryEditor } from '@8f4e/editor-gallery';
import type { EditorWebMcpBridge } from '@8f4e/editor-webmcp';
import { sharedAudioContext } from './shared-audio-context';

interface GalleryEditorSessionOptions {
	title: string;
	projectUrl: string;
	frame: HTMLElement;
	status: HTMLElement;
	includeKeyboardModeSwitching?: boolean;
	onRetry(): void;
}

/** Own one selection's resources, including work that completes after disposal. */
export function mountGalleryEditorSession({
	title,
	projectUrl,
	frame,
	status,
	includeKeyboardModeSwitching,
	onRetry,
}: GalleryEditorSessionOptions): () => void {
	const canvas = document.createElement('canvas');
	canvas.tabIndex = 0;
	canvas.setAttribute('aria-label', `${title} editor`);
	frame.prepend(canvas);
	status.hidden = false;
	status.textContent = 'Loading project…';

	let editor: GalleryEditorInstance | undefined;
	let bridge: EditorWebMcpBridge | undefined;
	let loaded = false;
	let bridgeStarted = false;
	let disposed = false;
	let revealFrame = 0;

	const loadTimeout = window.setTimeout(() => showError(new Error('Project loading timed out')), 30_000);

	function dispose(): void {
		if (disposed) return;
		disposed = true;
		window.clearTimeout(loadTimeout);
		window.cancelAnimationFrame(revealFrame);
		bridge?.dispose();
		bridge = undefined;
		editor?.dispose();
		editor = undefined;
		canvas.remove();
	}

	async function connectBridge(): Promise<void> {
		if (disposed || !loaded || !editor || bridgeStarted) return;
		bridgeStarted = true;
		const mountedEditor = editor;
		try {
			const { createEditorWebMcp } = await import('@8f4e/editor-webmcp');
			if (disposed) return;
			bridge = createEditorWebMcp({
				document,
				editor: mountedEditor,
				getCompilerDiagnostics: mountedEditor.getCompilerDiagnostics,
			});
			await bridge.ready;
		} catch (error) {
			console.error('Failed to load gallery site tools:', error);
		}
	}

	function showError(error: unknown): void {
		if (disposed) return;
		dispose();
		status.hidden = false;
		status.textContent = 'This project could not be loaded.';
		const retryButton = document.createElement('button');
		retryButton.type = 'button';
		retryButton.textContent = 'Try again';
		retryButton.addEventListener('click', onRetry);
		status.append(retryButton);
		console.error('Failed to load gallery project:', error);
	}

	function reveal(): void {
		if (disposed) return;
		loaded = true;
		void connectBridge();
		window.clearTimeout(loadTimeout);
		revealFrame = window.requestAnimationFrame(() => {
			if (disposed) return;
			canvas.classList.add('editor-ready');
			status.hidden = true;
		});
	}

	async function mount(): Promise<void> {
		try {
			const mountedEditor = await mountGalleryEditor(canvas, {
				sharedAudioContext,
				captureWheel: true,
				touchNavigation: { axis: 'horizontal' },
				includeKeyboardModeSwitching,
				initialProjectUrl: projectUrl,
				onInitialProjectLoaded: reveal,
				onInitialProjectLoadError: showError,
			});
			if (disposed) {
				mountedEditor.dispose();
				return;
			}
			editor = mountedEditor;
			void connectBridge();
		} catch (error) {
			showError(error);
		}
	}

	// A pending project fetch must not block mounting a newer selection.
	void mount();
	return dispose;
}
