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

/** Measure submitted frames and sample wall-clock FPS independently of frame rendering costs. */
export function createFrameStats(
	engine: Pick<SpriteEngine, 'frameStats'>,
	onRenderStats: ((stats: RenderStats) => void) | undefined,
	intervalFrames = 60
) {
	const renderStatsIntervalFrames = Math.max(1, Math.floor(intervalFrames));
	let renderedFrameCount = 0;
	let statsSampleStartFrameCount = 0;
	let statsSampleStartTime = performance.now();

	function reset(): void {
		statsSampleStartTime = performance.now();
		statsSampleStartFrameCount = renderedFrameCount;
	}

	return {
		reset,
		emit(timeToRenderMs: number) {
			if (!onRenderStats) return;
			renderedFrameCount++;
			if (renderedFrameCount % renderStatsIntervalFrames !== 0) return;

			const now = performance.now();
			const elapsedMs = now - statsSampleStartTime;
			const sampledFrameCount = renderedFrameCount - statsSampleStartFrameCount;
			statsSampleStartTime = now;
			statsSampleStartFrameCount = renderedFrameCount;
			const fps = elapsedMs > 0 ? Math.round((sampledFrameCount * 1000) / elapsedMs) : 0;
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
