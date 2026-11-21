import type { ResolvedElasticViewportOptions } from './options';

export interface ViewportSpring {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export function createViewportSpring(): ViewportSpring {
	return { x: 0, y: 0, vx: 0, vy: 0 };
}

export function resetViewportSpring(spring: ViewportSpring): void {
	spring.x = 0;
	spring.y = 0;
	spring.vx = 0;
	spring.vy = 0;
}

/** Share the time-step response among springs with the same tuning. */
export function createViewportSpringSolver(
	frequency: number,
	maxOffsetPixels: number,
	{ dampingRatio, restDistancePixels, restSpeedPixelsPerSecond }: ResolvedElasticViewportOptions['spring']
): (spring: ViewportSpring, elapsedSeconds: number, dx: number, dy: number) => boolean {
	const decayRate = dampingRatio * frequency;
	const frequencySquared = frequency ** 2;
	const dampedFrequency = frequency * Math.sqrt(1 - dampingRatio ** 2);
	const maxOffsetSquared = maxOffsetPixels ** 2;
	const restDistanceSquared = restDistancePixels ** 2;
	const restSpeedSquared = restSpeedPixelsPerSecond ** 2;
	let preparedElapsedSeconds = 0;
	let positionFactor = 1;
	let velocityFactor = 1;
	let positionFromVelocity = 0;
	let velocityFromPosition = 0;
	return (spring, elapsedSeconds, dx, dy) => {
		const { x, y, vx, vy } = spring;
		if (elapsedSeconds > 0 && (x || y || vx || vy)) {
			if (elapsedSeconds !== preparedElapsedSeconds) {
				// Closed-form response: subdivisions of the same interval give the same result.
				const angle = dampedFrequency * elapsedSeconds;
				const decay = Math.exp(-decayRate * elapsedSeconds);
				// At critical damping, sin(frequency * time) / frequency tends to time.
				const sine = dampedFrequency === 0 ? elapsedSeconds : Math.sin(angle) / dampedFrequency;
				const cosine = Math.cos(angle);
				positionFactor = decay * (cosine + decayRate * sine);
				velocityFactor = decay * (cosine - decayRate * sine);
				positionFromVelocity = decay * sine;
				velocityFromPosition = -frequencySquared * positionFromVelocity;
				preparedElapsedSeconds = elapsedSeconds;
			}
			spring.x = positionFactor * x + positionFromVelocity * vx;
			spring.y = positionFactor * y + positionFromVelocity * vy;
			spring.vx = velocityFromPosition * x + velocityFactor * vx;
			spring.vy = velocityFromPosition * y + velocityFactor * vy;
		}

		// Apply the camera step after sampling; the logical screen origin moved in the opposite direction.
		spring.x += dx;
		spring.y += dy;
		const distanceSquared = spring.x ** 2 + spring.y ** 2;
		if (distanceSquared > maxOffsetSquared) {
			const scale = Math.sqrt(maxOffsetSquared / distanceSquared);
			spring.x *= scale;
			spring.y *= scale;
		}
		if (distanceSquared < restDistanceSquared && spring.vx ** 2 + spring.vy ** 2 < restSpeedSquared) {
			resetViewportSpring(spring);
			return false;
		}

		return true;
	};
}
