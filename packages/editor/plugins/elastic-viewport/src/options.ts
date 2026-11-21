/** One point on the pan response curve, based on a block's displayed area. */
export interface ElasticViewportSizeProfile {
	/** Block area in grid cells. */
	readonly gridCells: number;
	/** Positive natural spring frequency in radians per second. */
	readonly frequency: number;
	/** Multiplier from 0 to 1 applied to the spring offset. */
	readonly influence: number;
}

export interface ElasticViewportSpringOptions {
	/** Damping ratio in (0, 1]. Lower values bounce more; 1 settles without overshooting. Default: 0.63. */
	readonly dampingRatio?: number;
	/** Positive rest distance in pixels. Default: 0.25. */
	readonly restDistancePixels?: number;
	/** Positive rest speed in pixels per second. Default: 1. */
	readonly restSpeedPixelsPerSecond?: number;
}

export interface ElasticViewportPanOptions {
	/** Maximum unscaled pan spring displacement in pixels. Default: 48. */
	readonly maxOffsetPixels?: number;
	/** Replaces the default profiles. Profiles must be ordered by strictly increasing grid-cell area. */
	readonly sizeProfiles?: readonly [ElasticViewportSizeProfile, ...ElasticViewportSizeProfile[]];
}

export interface ElasticViewportEntryOptions {
	/** Positive pull distance in pixels before release; also caps the entry spring's displacement. Default: 96. */
	readonly releaseDistancePixels?: number;
	/** Time without inward panning before a held block releases, in milliseconds. Default: 90. */
	readonly idleReleaseMs?: number;
	/** Positive release spring frequency in radians per second. Default: 23. */
	readonly frequency?: number;
}

export interface ElasticViewportPluginOptions {
	/** Reports the host's current reduced-motion preference. */
	readonly prefersReducedMotion: () => boolean;
	/** Settings shared by pan and entry springs. */
	readonly spring?: ElasticViewportSpringOptions;
	readonly pan?: ElasticViewportPanOptions;
	readonly entry?: ElasticViewportEntryOptions;
	/** Frame gap in milliseconds beyond which motion resets. Default: 150. */
	readonly maxFrameGapMs?: number;
	/** Camera step in pixels beyond which motion resets. Default: 240. */
	readonly maxCameraStepPixels?: number;
}

const DEFAULT_SIZE_PROFILES = [
	{ gridCells: 80, frequency: 26, influence: 0.22 },
	{ gridCells: 200, frequency: 21, influence: 0.35 },
	{ gridCells: 500, frequency: 17, influence: 0.5 },
	{ gridCells: 900, frequency: 13, influence: 0.64 },
] as const;

export function resolveElasticViewportOptions({
	prefersReducedMotion,
	spring,
	pan,
	entry,
	maxFrameGapMs = 150,
	maxCameraStepPixels = 240,
}: ElasticViewportPluginOptions) {
	return {
		prefersReducedMotion,
		maxFrameGapMs,
		maxCameraStepPixels,
		spring: {
			dampingRatio: spring?.dampingRatio ?? 0.63,
			restDistancePixels: spring?.restDistancePixels ?? 0.25,
			restSpeedPixelsPerSecond: spring?.restSpeedPixelsPerSecond ?? 1,
		},
		pan: {
			maxOffsetPixels: pan?.maxOffsetPixels ?? 48,
			sizeProfiles: pan?.sizeProfiles?.map(profile => ({ ...profile })) ?? DEFAULT_SIZE_PROFILES,
		},
		entry: {
			releaseDistancePixels: entry?.releaseDistancePixels ?? 96,
			idleReleaseMs: entry?.idleReleaseMs ?? 90,
			frequency: entry?.frequency ?? 23,
		},
	};
}

export type ResolvedElasticViewportOptions = ReturnType<typeof resolveElasticViewportOptions>;
