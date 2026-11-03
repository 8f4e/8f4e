import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import sharp from 'sharp';

import { startPreviewServer } from './server';

export const PROJECT_PREVIEW_FORMATS = ['icon'] as const;
export type ProjectPreviewFormat = (typeof PROJECT_PREVIEW_FORMATS)[number];

export const DEFAULT_PREVIEW_SIZE = 64;
export const ICON_PREVIEW_SIZE = DEFAULT_PREVIEW_SIZE;
export const DEFAULT_PREVIEW_POSITION = { x: 0, y: 0 } as const;
export const DEFAULT_PREVIEW_START_AT_MS = 0;
export const DEFAULT_PREVIEW_CAPTURE_INTERVAL_MS = 1_000;
export const DEFAULT_PREVIEW_FRAME_COUNT = 1;
export const DEFAULT_PREVIEW_FRAMES_PER_SECOND = 1;
/** @deprecated Use `DEFAULT_PREVIEW_START_AT_MS`. */
export const DEFAULT_PREVIEW_RUN_FOR_MS = DEFAULT_PREVIEW_START_AT_MS;

const AUDIO_PERMISSION_DIALOG_ID = 'audio-worklet-permission';
const AUDIO_PERMISSION_BUTTON_TITLE = 'Allow';

export interface ProjectPreviewPosition {
	/** Horizontal distance between the image's left edge and the code block's left edge. */
	x: number;
	/** Vertical distance between the image's top edge and the code block's top edge. */
	y: number;
}

export interface GenerateProjectPreviewOptions {
	/** Milliseconds to wait between screenshots used as animation frames. */
	captureIntervalMs?: number;
	/** Preview layout to render. */
	format: ProjectPreviewFormat;
	/** Number of screenshots to encode as GIF frames. */
	frameCount?: number;
	/** Playback rate for animated GIF frames, independent of capture timing. */
	framesPerSecond?: number;
	/** Path to an 8f4e project source file. */
	inputPath: string;
	/** Destination path for the generated GIF. */
	outputPath: string;
	/** Distance between the preview edges and the target code block. */
	position?: ProjectPreviewPosition;
	/** @deprecated Use `startAtMs`. */
	runForMs?: number;
	/** Width and height of the square output image in pixels. */
	size?: number;
	/** Start an audio runtime and wait this many milliseconds before capturing the first frame. */
	startAtMs?: number;
	/** Maximum time to wait for the editor to load and render the project. */
	timeoutMs?: number;
}

interface PreviewCodeBlock {
	isHome: boolean;
	x: number;
	y: number;
}

interface PreviewDialogButton {
	height: number;
	title: string;
	width: number;
	x: number;
	y: number;
}

interface PreviewState {
	codeBlockRendering: {
		currentProject: { blocks: PreviewCodeBlock[] };
		rootProject: { blocks: PreviewCodeBlock[] };
		selectedCodeBlock?: PreviewCodeBlock;
	};
	dialog: {
		buttons: PreviewDialogButton[];
		id: string;
		x: number;
		y: number;
	};
	dialogStack: Array<{ id: string }>;
	featureFlags: {
		modeOverlay: boolean;
		offscreenBlockArrows: boolean;
	};
	initialProjectState?: unknown;
	viewport: {
		height: number;
		width: number;
		x: number;
		y: number;
	};
	viewportAnimation: {
		active: boolean;
	};
}

interface PreviewWindow {
	requestAnimationFrame: (callback: () => void) => number;
	state?: PreviewState;
}

function resolveEditorAssetsPath(): string {
	const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	return path.resolve(packageRoot, '../../packages/editor/packages/editor-website/dist');
}

async function validatePaths(inputPath: string, outputPath: string, editorAssetsPath: string): Promise<void> {
	if (path.extname(inputPath) !== '.8f4e') {
		throw new Error(`Project input must be an .8f4e file: ${inputPath}`);
	}

	const inputStat = await fs.stat(inputPath).catch(() => undefined);
	if (!inputStat?.isFile()) {
		throw new Error(`Project input does not exist or is not a file: ${inputPath}`);
	}

	if (path.extname(outputPath).toLowerCase() !== '.gif') {
		throw new Error(`Preview output must be a .gif file: ${outputPath}`);
	}

	const editorEntryPoint = path.join(editorAssetsPath, 'index.html');
	const editorStat = await fs.stat(editorEntryPoint).catch(() => undefined);
	if (!editorStat?.isFile()) {
		throw new Error(
			`Editor website build not found at ${editorEntryPoint}. Build @8f4e/editor-website before generating previews.`
		);
	}
}

function getGifFrameDelayMs(framesPerSecond: number): number {
	return Math.round(1_000 / framesPerSecond);
}

function validateRenderOptions(
	size: number,
	position: ProjectPreviewPosition,
	startAtMs: number,
	captureIntervalMs: number,
	frameCount: number,
	framesPerSecond: number
): void {
	if (!Number.isSafeInteger(size) || size <= 0) {
		throw new Error(`Preview size must be a positive integer: ${size}`);
	}
	if (!Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
		throw new Error(`Preview position offsets must be integers: ${position.x}, ${position.y}`);
	}
	if (!Number.isSafeInteger(startAtMs) || startAtMs < 0) {
		throw new Error(`Preview start time must be a non-negative integer: ${startAtMs}`);
	}
	if (!Number.isSafeInteger(captureIntervalMs) || captureIntervalMs <= 0) {
		throw new Error(`Preview capture interval must be a positive integer: ${captureIntervalMs}`);
	}
	if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
		throw new Error(`Preview frame count must be a positive integer: ${frameCount}`);
	}
	if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
		throw new Error(`Preview playback rate must be a positive number: ${framesPerSecond}`);
	}
	const gifFrameDelayMs = getGifFrameDelayMs(framesPerSecond);
	if (gifFrameDelayMs < 10 || gifFrameDelayMs > 65_535) {
		throw new Error(`Preview playback rate must produce a GIF frame delay between 10 and 65535 milliseconds`);
	}
}

async function writePreviewImage(pngFrames: Buffer[], outputPath: string, framesPerSecond: number): Promise<void> {
	const image = pngFrames.length === 1 ? sharp(pngFrames[0]) : sharp(pngFrames, { join: { animated: true } });
	const animationOptions =
		pngFrames.length === 1
			? {}
			: {
					delay: pngFrames.map(() => getGifFrameDelayMs(framesPerSecond)),
					loop: 0,
				};
	await image
		.gif({
			colours: 256,
			dither: 0,
			effort: 10,
			reuse: false,
			...animationOptions,
		})
		.toFile(outputPath);
}

/**
 * Generates a deterministic project preview with the production editor renderer.
 *
 * The icon format places the first valid `@home` code block, or the first root
 * code block, at the configured position and captures a square image.
 */
export async function generateProjectPreview({
	captureIntervalMs = DEFAULT_PREVIEW_CAPTURE_INTERVAL_MS,
	format,
	frameCount = DEFAULT_PREVIEW_FRAME_COUNT,
	framesPerSecond = DEFAULT_PREVIEW_FRAMES_PER_SECOND,
	inputPath,
	outputPath,
	position = DEFAULT_PREVIEW_POSITION,
	runForMs,
	size = DEFAULT_PREVIEW_SIZE,
	startAtMs,
	timeoutMs = 15_000,
}: GenerateProjectPreviewOptions): Promise<void> {
	if (format !== 'icon') {
		throw new Error(`Unsupported preview format: ${format as string}`);
	}

	const resolvedInputPath = path.resolve(inputPath);
	const resolvedOutputPath = path.resolve(outputPath);
	const editorAssetsPath = resolveEditorAssetsPath();
	if (startAtMs !== undefined && runForMs !== undefined) {
		throw new Error('Use either startAtMs or the deprecated runForMs option, not both');
	}
	const shouldStartAudio = startAtMs !== undefined || runForMs !== undefined;
	const firstCaptureTimeMs = startAtMs ?? runForMs ?? DEFAULT_PREVIEW_START_AT_MS;
	validateRenderOptions(size, position, firstCaptureTimeMs, captureIntervalMs, frameCount, framesPerSecond);
	await validatePaths(resolvedInputPath, resolvedOutputPath, editorAssetsPath);
	await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });

	const previewServer = await startPreviewServer({
		editorAssetsPath,
		projectPath: resolvedInputPath,
	});
	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

	try {
		browser = await chromium.launch({ headless: true });
		const initialViewport = shouldStartAudio
			? { width: Math.max(size, 640), height: Math.max(size, 480) }
			: { width: size, height: size };
		const page = await browser.newPage({
			deviceScaleFactor: 1,
			viewport: initialViewport,
		});
		const pageErrors: string[] = [];
		page.on('pageerror', error => pageErrors.push(error.message));

		const projectResponsePromise = page.waitForResponse(
			response => new URL(response.url()).pathname === '/project.8f4e',
			{ timeout: timeoutMs }
		);
		await page.goto(`${previewServer.url}/?projectUrl=${encodeURIComponent('/project.8f4e')}`, {
			waitUntil: 'domcontentloaded',
			timeout: timeoutMs,
		});
		const projectResponse = await projectResponsePromise;
		if (!projectResponse.ok()) {
			throw new Error(`Editor failed to load the project: HTTP ${projectResponse.status()}`);
		}

		try {
			await page.waitForFunction(
				() => {
					const state = (globalThis as unknown as PreviewWindow).state;
					return Boolean(state?.initialProjectState && state.codeBlockRendering.rootProject.blocks.length > 0);
				},
				undefined,
				{ timeout: timeoutMs }
			);
		} catch {
			const suffix = pageErrors.length > 0 ? ` Browser error: ${pageErrors.at(-1)}` : '';
			throw new Error(`Project failed to load in the editor.${suffix}`);
		}

		const canvas = page.locator('#glcanvas');
		if (shouldStartAudio) {
			try {
				await page.waitForFunction(
					([dialogId, buttonTitle]) => {
						const state = (globalThis as unknown as PreviewWindow).state;
						return state?.dialog.id === dialogId && state.dialog.buttons.some(button => button.title === buttonTitle);
					},
					[AUDIO_PERMISSION_DIALOG_ID, AUDIO_PERMISSION_BUTTON_TITLE],
					{ timeout: timeoutMs }
				);
			} catch {
				const suffix = pageErrors.length > 0 ? ` Browser error: ${pageErrors.at(-1)}` : '';
				throw new Error(`Project did not request audio runtime permission before the timeout.${suffix}`);
			}

			const allowButtonPosition = await page.evaluate(
				([dialogId, buttonTitle]) => {
					const state = (globalThis as unknown as PreviewWindow).state;
					const button = state?.dialog.buttons.find(candidate => candidate.title === buttonTitle);
					if (!state || state.dialog.id !== dialogId || !button) {
						throw new Error('Audio permission dialog disappeared before it could be accepted');
					}
					return {
						x: state.dialog.x + button.x + button.width / 2,
						y: state.dialog.y + button.y + button.height / 2,
					};
				},
				[AUDIO_PERMISSION_DIALOG_ID, AUDIO_PERMISSION_BUTTON_TITLE]
			);

			await canvas.click({ position: allowButtonPosition });
			if (firstCaptureTimeMs > 0) {
				await page.waitForTimeout(firstCaptureTimeMs);
			}

			const permissionRequestedAgain = await page.evaluate(dialogId => {
				const state = (globalThis as unknown as PreviewWindow).state;
				return state?.dialogStack.some(dialog => dialog.id === dialogId) ?? false;
			}, AUDIO_PERMISSION_DIALOG_ID);
			if (permissionRequestedAgain) {
				const suffix = pageErrors.length > 0 ? ` Browser error: ${pageErrors.at(-1)}` : '';
				throw new Error(`Audio runtime failed to start.${suffix}`);
			}

			await page.setViewportSize({ width: size, height: size });
			await page.waitForFunction(
				([width, height]) => {
					const state = (globalThis as unknown as PreviewWindow).state;
					return state?.viewport.width === width && state.viewport.height === height;
				},
				[size, size],
				{ timeout: timeoutMs }
			);
		}

		await page.evaluate(async previewPosition => {
			const previewWindow = globalThis as unknown as PreviewWindow;
			const state = previewWindow.state;
			const targetBlock =
				state?.codeBlockRendering.rootProject.blocks.find(block => block.isHome) ??
				state?.codeBlockRendering.rootProject.blocks[0];
			if (!state || !targetBlock) {
				throw new Error('Preview code block disappeared before capture');
			}

			state.viewportAnimation.active = false;
			state.viewport.x = targetBlock.x - previewPosition.x;
			state.viewport.y = targetBlock.y - previewPosition.y;
			state.featureFlags.modeOverlay = false;
			state.featureFlags.offscreenBlockArrows = false;
			state.codeBlockRendering.selectedCodeBlock = undefined;
			state.dialogStack.length = 0;

			await new Promise<void>(resolve => previewWindow.requestAnimationFrame(() => resolve()));
			await new Promise<void>(resolve => previewWindow.requestAnimationFrame(() => resolve()));
		}, position);

		const pngFrames: Buffer[] = [];
		for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
			if (frameIndex > 0) {
				await page.waitForTimeout(captureIntervalMs);
			}

			const renderDeadline = Date.now() + timeoutMs;
			let png: Buffer<ArrayBufferLike> = Buffer.alloc(0);
			while (Date.now() < renderDeadline) {
				png = await canvas.screenshot({ type: 'png' });
				const stats = await sharp(png).stats();
				if (stats.channels.some(channel => channel.stdev > 0)) {
					break;
				}
				await page.waitForTimeout(50);
			}
			if (png.length === 0 || !(await sharp(png).stats()).channels.some(channel => channel.stdev > 0)) {
				throw new Error('Project preview did not render visible content before the timeout.');
			}
			pngFrames.push(png);
		}
		await writePreviewImage(pngFrames, resolvedOutputPath, framesPerSecond);
	} finally {
		try {
			await browser?.close();
		} finally {
			await previewServer.close();
		}
	}
}
