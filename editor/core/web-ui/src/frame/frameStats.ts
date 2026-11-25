import type { SpriteEngine } from '../webgl/spriteEngine';

export interface RenderStats {
	timeToRenderMs: number;
	fps: number;
	frameBudgetMs: number;
	headroomMs: number;
	fpsCapacity: number;
	spriteCount: number;
	uploadedInstanceBytes: number;
}

const SAMPLE_INTERVAL_FRAMES = 60;

/** Measure submitted frames and sample wall-clock FPS independently of frame rendering costs. */
export function createFrameStats(
	engine: Pick<SpriteEngine, 'frameStats'>,
	onRenderStats: ((stats: RenderStats) => void) | undefined
) {
	let sampledFrameCount = 0;
	let sampleStartTime = onRenderStats ? performance.now() : 0;

	function reset(): void {
		sampledFrameCount = 0;
		if (onRenderStats) sampleStartTime = performance.now();
	}

	return {
		reset,
		beginFrame(): number | undefined {
			return onRenderStats && sampledFrameCount === SAMPLE_INTERVAL_FRAMES - 1 ? performance.now() : undefined;
		},
		endFrame(frameStartedAt: number | undefined) {
			if (!onRenderStats) return;
			if (frameStartedAt === undefined) {
				sampledFrameCount++;
				return;
			}

			const now = performance.now();
			const timeToRenderMs = now - frameStartedAt;
			const elapsedMs = now - sampleStartTime;
			sampledFrameCount = 0;
			sampleStartTime = now;
			const fps = elapsedMs > 0 ? Math.round((SAMPLE_INTERVAL_FRAMES * 1000) / elapsedMs) : 0;
			const frameBudgetMs = fps > 0 ? 1000 / fps : 0;
			const headroomMs = frameBudgetMs > 0 ? frameBudgetMs - timeToRenderMs : 0;
			const fpsCapacity = timeToRenderMs > 0 ? Math.round(1000 / timeToRenderMs) : 0;
			onRenderStats({
				timeToRenderMs,
				fps,
				frameBudgetMs,
				headroomMs,
				fpsCapacity,
				spriteCount: engine.frameStats.spriteCount,
				uploadedInstanceBytes: engine.frameStats.uploadedInstanceBytes,
			});
		},
	};
}
