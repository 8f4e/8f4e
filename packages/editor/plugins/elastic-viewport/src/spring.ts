import type { ResolvedElasticViewportOptions } from './options';

export interface ViewportSpring {
	readonly decayRate: number;
	readonly frequencySquared: number;
	readonly dampedFrequency: number;
	readonly maxOffsetSquared: number;
	readonly restDistanceSquared: number;
	readonly restSpeedSquared: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export function createViewportSpring(
	frequency: number,
	maxOffsetPixels: number,
	{ dampingRatio, restDistancePixels, restSpeedPixelsPerSecond }: ResolvedElasticViewportOptions['spring']
): ViewportSpring {
	return {
		decayRate: dampingRatio * frequency,
		frequencySquared: frequency ** 2,
		dampedFrequency: frequency * Math.sqrt(1 - dampingRatio ** 2),
		maxOffsetSquared: maxOffsetPixels ** 2,
		restDistanceSquared: restDistancePixels ** 2,
		restSpeedSquared: restSpeedPixelsPerSecond ** 2,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
	};
}

export function resetViewportSpring(spring: ViewportSpring): void {
	spring.x = 0;
	spring.y = 0;
	spring.vx = 0;
	spring.vy = 0;
}

/** Sample a damped spring at the frame boundary, then apply the new camera step. */
export function advanceViewportSpring(spring: ViewportSpring, elapsedSeconds: number, dx: number, dy: number): boolean {
	const { x, y, vx, vy, decayRate, frequencySquared, dampedFrequency } = spring;
	if (elapsedSeconds > 0 && (x || y || vx || vy)) {
		// Closed-form response: subdivisions of the same interval give the same result.
		const angle = dampedFrequency * elapsedSeconds;
		const decay = Math.exp(-decayRate * elapsedSeconds);
		// At critical damping, sin(frequency * time) / frequency tends to time.
		const sine = dampedFrequency === 0 ? elapsedSeconds : Math.sin(angle) / dampedFrequency;
		const cosine = Math.cos(angle);
		const positionFactor = decay * (cosine + decayRate * sine);
		const velocityFactor = decay * (cosine - decayRate * sine);
		const positionFromVelocity = decay * sine;
		const velocityFromPosition = -frequencySquared * positionFromVelocity;
		spring.x = positionFactor * x + positionFromVelocity * vx;
		spring.y = positionFactor * y + positionFromVelocity * vy;
		spring.vx = velocityFromPosition * x + velocityFactor * vx;
		spring.vy = velocityFromPosition * y + velocityFactor * vy;
	}

	// The viewport's positive delta moves the logical screen origin in the opposite direction.
	spring.x += dx;
	spring.y += dy;
	const distanceSquared = spring.x ** 2 + spring.y ** 2;
	if (distanceSquared > spring.maxOffsetSquared) {
		const scale = Math.sqrt(spring.maxOffsetSquared / distanceSquared);
		spring.x *= scale;
		spring.y *= scale;
	}
	if (distanceSquared < spring.restDistanceSquared && spring.vx ** 2 + spring.vy ** 2 < spring.restSpeedSquared) {
		resetViewportSpring(spring);
		return false;
	}

	return true;
}
