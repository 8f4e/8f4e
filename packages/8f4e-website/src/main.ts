import { type DefaultEditorInstance, mountDefaultEditor } from '@8f4e/editor-default';
import { getExampleProjectUrl } from './example-projects';
import { sharedAudioContext } from './shared-audio-context';

const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('.editor-row canvas'));
if (canvases.length === 0) {
	throw new Error('Editor canvases not found');
}

const renderingReleaseDelayMs = 2_000;
const editorByCanvas = new Map<HTMLCanvasElement, DefaultEditorInstance>();
const editorMountPromiseByCanvas = new Map<HTMLCanvasElement, Promise<DefaultEditorInstance>>();
const renderingReleaseTimeoutByCanvas = new Map<HTMLCanvasElement, number>();
const revealAnimationFrameByCanvas = new Map<HTMLCanvasElement, number>();
const editors: DefaultEditorInstance[] = [];
let disposed = false;

function syncEditors(): void {
	editors.splice(
		0,
		editors.length,
		...canvases.flatMap(canvas => {
			const editor = editorByCanvas.get(canvas);
			return editor ? [editor] : [];
		})
	);
}

function revealEditorAfterFirstProjectFrame(canvas: HTMLCanvasElement, editor: DefaultEditorInstance): void {
	const waitForProject = () => {
		if (disposed) {
			return;
		}

		if (!editor.state.initialProjectState) {
			revealAnimationFrameByCanvas.set(canvas, window.requestAnimationFrame(waitForProject));
			return;
		}

		revealAnimationFrameByCanvas.set(
			canvas,
			window.requestAnimationFrame(() => {
				revealAnimationFrameByCanvas.delete(canvas);
				if (!disposed) {
					canvas.classList.add('editor-ready');
				}
			})
		);
	};

	waitForProject();
}

const renderingObserver = new IntersectionObserver(entries => {
	for (const entry of entries) {
		const canvas = entry.target as HTMLCanvasElement;
		const editor = editorByCanvas.get(canvas);
		const pendingRelease = renderingReleaseTimeoutByCanvas.get(canvas);
		if (pendingRelease !== undefined) {
			window.clearTimeout(pendingRelease);
			renderingReleaseTimeoutByCanvas.delete(canvas);
		}
		if (entry.isIntersecting) {
			editor?.resumeRendering();
		} else {
			editor?.pauseRendering();
			const timeout = window.setTimeout(() => {
				renderingReleaseTimeoutByCanvas.delete(canvas);
				editor?.releaseRenderingResources();
			}, renderingReleaseDelayMs);
			renderingReleaseTimeoutByCanvas.set(canvas, timeout);
		}
	}
});

function mountEditor(canvas: HTMLCanvasElement, index: number): Promise<DefaultEditorInstance> {
	const pendingMount = editorMountPromiseByCanvas.get(canvas);
	if (pendingMount) {
		return pendingMount;
	}

	const mountPromise = mountDefaultEditor(canvas, {
		sharedAudioContext,
		captureWheel: false,
		featureFlags: {
			modeToggling: false,
			projectCreation: false,
		},
		showOpenMenuItem: false,
		initialEditorMode: 'edit',
		initialProjectUrl: canvas.dataset.projectPath ? getExampleProjectUrl(canvas.dataset.projectPath) : undefined,
		storage: window.localStorage,
		storageNamespace: index === 0 ? '8f4e-website' : `8f4e-website-${index + 1}`,
	})
		.then(editor => {
			if (disposed) {
				editor.dispose();
				return editor;
			}

			editorByCanvas.set(canvas, editor);
			revealEditorAfterFirstProjectFrame(canvas, editor);
			syncEditors();
			renderingObserver.observe(canvas);
			if (index === 0) {
				Object.assign(window, { editor, state: editor.state });
			}
			return editor;
		})
		.catch(error => {
			editorMountPromiseByCanvas.delete(canvas);
			throw error;
		});

	editorMountPromiseByCanvas.set(canvas, mountPromise);
	return mountPromise;
}

const canvasIndex = new Map(canvases.map((canvas, index) => [canvas, index]));
const mountingObserver = new IntersectionObserver(entries => {
	for (const entry of entries) {
		if (!entry.isIntersecting) {
			continue;
		}

		const canvas = entry.target as HTMLCanvasElement;
		const index = canvasIndex.get(canvas);
		if (index === undefined) {
			continue;
		}

		void mountEditor(canvas, index)
			.then(() => mountingObserver.unobserve(canvas))
			.catch(error => console.error('Failed to mount editor:', error));
	}
});
for (const canvas of canvases) {
	mountingObserver.observe(canvas);
}

Object.assign(window, { editors });

import.meta.hot?.dispose(() => {
	disposed = true;
	mountingObserver.disconnect();
	renderingObserver.disconnect();
	for (const timeout of renderingReleaseTimeoutByCanvas.values()) {
		window.clearTimeout(timeout);
	}
	renderingReleaseTimeoutByCanvas.clear();
	for (const animationFrame of revealAnimationFrameByCanvas.values()) {
		window.cancelAnimationFrame(animationFrame);
	}
	revealAnimationFrameByCanvas.clear();
	for (const editor of editors) {
		editor.dispose();
	}
	editors.length = 0;
	editorByCanvas.clear();
});
