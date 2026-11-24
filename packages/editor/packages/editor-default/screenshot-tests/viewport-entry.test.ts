import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { createElasticViewportPlugin } from '@8f4e/editor-plugin-elastic-viewport';
import { createMouseInputPlugin } from '@8f4e/editor-plugin-mouse-input';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { Engine } from 'glugglugglug';
import { afterEach, expect, test, vi } from 'vitest';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup() {
	const canvas = document.createElement('canvas');
	canvas.width = 440;
	canvas.height = 176;
	canvas.style.cssText = 'width:440px;height:176px';
	document.body.append(canvas);
	cleanups.push(() => canvas.remove());

	let events!: EditorPluginContext['events'];
	let presentedX: number | undefined;
	let drawn = false;
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 300 100', 'constantsEnd'] }],
			notes: [
				{ id: 1, code: ['note anchor', '; @pos 45 6', '; already in view', 'noteEnd'] },
				{ id: 2, code: ['note incoming', '; @pos 80 3', '; held at the edge', 'noteEnd'] },
			],
		},
		plugins: [
			createMouseInputPlugin({ inputTarget: canvas }),
			createElasticViewportPlugin({ prefersReducedMotion: () => false }),
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			{
				id: 'viewport-entry-probe',
				setup: services => {
					events = services.events;
					const removeFrameProbe = services.renderRegistry.registerCanvasBackgroundDrawer(({ blockPositions }) => {
						presentedX = blockPositions.ordered.find(({ codeBlock }) => codeBlock.name === 'incoming')?.x;
					});
					const removeCodeBlockDrawer = services.renderRegistry.registerCodeBlockDrawer(({ codeBlock }) => {
						if (codeBlock.name === 'incoming') drawn = true;
					});
					return () => {
						removeFrameProbe();
						removeCodeBlockDrawer();
					};
				},
			},
		],
	});
	cleanups.push(() => editor.dispose());
	editor.pauseRendering();

	const start = performance.now() + 200;
	const clock = vi.spyOn(performance, 'now');
	cleanups.push(() => clock.mockRestore());
	const { viewport, project } = editor.state;
	const incoming = project.activeLevel.blocks.find(block => block.name === 'incoming')!;
	viewport.x = incoming.x - viewport.width - 6;
	viewport.y = 0;
	const frame = (elapsed: number) => {
		clock.mockReturnValue(start + elapsed);
		drawn = false;
		editor.renderFrame();
		return { x: presentedX!, drawn };
	};
	return { canvas, events, viewport, incoming, frame };
}

test('holds an entering block at the viewport edge during manual panning, then springs it into view', async () => {
	const { canvas, events, viewport, incoming, frame } = await setup();
	const { x: worldX, y: worldY } = incoming;
	const pan = (deltaX: number) => canvas.dispatchEvent(new WheelEvent('wheel', { deltaX, cancelable: true }));
	const logicalLeft = () => worldX - viewport.x;
	const { width, height } = viewport;
	expect(frame(0)).toEqual({ x: width + 6, drawn: false });

	pan(16);
	expect(logicalLeft()).toBe(width - 10);
	expect(frame(16)).toEqual({ x: width, drawn: false });

	// The held block already occupies the rightmost pixels for hit testing.
	const hit = vi.fn();
	events.on('codeBlockPointerDown', hit, { capture: true });
	events.dispatch(
		'pointerdown',
		{
			x: width - 1,
			y: worldY - viewport.y + 4,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			altKey: false,
			stopPropagation: false,
			canvasWidth: width,
			canvasHeight: height,
		},
		{ phase: 'capture' }
	);
	expect(hit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ codeBlock: incoming }));
	events.off('codeBlockPointerDown', hit);

	pan(56);
	// The block stays outside even with more than the former 48 px pull.
	expect(frame(32)).toEqual({ x: width, drawn: false });
	pan(50);
	const released = frame(48);
	// The pull reaches 96 px, but the release still starts near the edge.
	expect(released.x).toBeGreaterThanOrEqual(width - 12);
	expect(released.x).toBeLessThanOrEqual(width);
	// More pan tension releases the block without waiting for the viewport to settle.
	const entering = frame(64);
	expect(entering.drawn).toBe(true);
	expect(entering.x).toBeLessThan(released.x);
	expect(entering.x).toBeGreaterThan(logicalLeft());
	let overshot = false;
	for (let elapsed = 80; elapsed < 1000; elapsed += 16) {
		const rendered = frame(elapsed);
		if (elapsed === 112) await expect(canvas).toMatchScreenshot('elastic-viewport-entry');
		overshot ||= rendered.x < logicalLeft();
	}
	expect(overshot).toBe(true);
	expect(frame(1000)).toEqual({ x: logicalLeft(), drawn: true });
	expect(incoming).toMatchObject({ x: worldX, y: worldY });
	expect(logicalLeft()).toBe(width - 116);
});

test('does not hold a block at the edge after a programmatic viewport change', async () => {
	const { viewport, frame } = await setup();
	expect(frame(0)).toEqual({ x: viewport.width + 6, drawn: false });

	viewport.x += 16;
	const entering = frame(16);
	expect(entering.x).toBeLessThan(viewport.width);
	expect(entering.drawn).toBe(true);
});
