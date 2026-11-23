import { type LandingEditorInstance, mountLandingEditor } from '@8f4e/editor-landing';
import { getHomepageProjectUrl } from './homepage-projects';

export function mountHomepageEditors(): () => void {
	const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('.editor-row canvas'));
	if (canvases.length === 0) {
		throw new Error('Editor canvases not found');
	}

	const renderingReleaseDelayMs = 2_000;
	const editorByCanvas = new Map<HTMLCanvasElement, LandingEditorInstance>();
	const editorMountPromiseByCanvas = new Map<HTMLCanvasElement, Promise<LandingEditorInstance>>();
	const renderingReleaseTimeoutByCanvas = new Map<HTMLCanvasElement, number>();
	const revealAnimationFrameByCanvas = new Map<HTMLCanvasElement, number>();
	let disposed = false;

	function revealEditorAfterMount(canvas: HTMLCanvasElement): void {
		if (disposed) return;
		revealAnimationFrameByCanvas.set(
			canvas,
			window.requestAnimationFrame(() => {
				revealAnimationFrameByCanvas.delete(canvas);
				if (!disposed) canvas.classList.add('editor-ready');
			})
		);
	}

	function showProjectLoadError(canvas: HTMLCanvasElement, error: unknown): void {
		if (disposed) return;
		const frame = canvas.parentElement!;
		const status = frame.querySelector('.editor-load-error') ?? document.createElement('div');
		status.className = 'editor-load-error';
		status.setAttribute('role', 'alert');
		status.textContent = 'This project could not be loaded. Reload the page to try again.';
		frame.append(status);
		console.error('Failed to load homepage project:', error);
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

	function mountEditor(canvas: HTMLCanvasElement): Promise<LandingEditorInstance> {
		const pendingMount = editorMountPromiseByCanvas.get(canvas);
		if (pendingMount) {
			return pendingMount;
		}

		let sourceLoaded = false;
		let sourceLoadFailed = false;
		const mountPromise = mountLandingEditor(canvas, {
			captureWheel: false,
			touchNavigation: { axis: 'horizontal' },
			initialProjectUrl: canvas.dataset.projectPath ? getHomepageProjectUrl(canvas.dataset.projectPath) : undefined,
			onInitialProjectLoaded: () => {
				sourceLoaded = true;
			},
			onInitialProjectLoadError: error => {
				sourceLoadFailed = true;
				showProjectLoadError(canvas, error);
			},
		})
			.then(editor => {
				if (disposed) {
					editor.dispose();
					return editor;
				}

				editorByCanvas.set(canvas, editor);
				renderingObserver.observe(canvas);
				if (sourceLoaded) {
					canvas.parentElement?.querySelector('.editor-load-error')?.remove();
					revealEditorAfterMount(canvas);
				}
				return editor;
			})
			.catch(error => {
				editorMountPromiseByCanvas.delete(canvas);
				if (!sourceLoadFailed) showProjectLoadError(canvas, error);
				throw error;
			});

		editorMountPromiseByCanvas.set(canvas, mountPromise);
		return mountPromise;
	}

	const mountingObserver = new IntersectionObserver(entries => {
		for (const entry of entries) {
			if (!entry.isIntersecting) {
				continue;
			}

			const canvas = entry.target as HTMLCanvasElement;
			void mountEditor(canvas)
				.then(() => mountingObserver.unobserve(canvas))
				.catch(error => console.error('Failed to mount editor:', error));
		}
	});
	for (const canvas of canvases) {
		mountingObserver.observe(canvas);
	}

	function dispose(): void {
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
		for (const editor of editorByCanvas.values()) {
			editor.dispose();
		}
		editorByCanvas.clear();
		editorMountPromiseByCanvas.clear();
	}

	return dispose;
}
