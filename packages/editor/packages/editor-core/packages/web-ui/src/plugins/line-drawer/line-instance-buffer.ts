export const LINE_INSTANCE_BYTE_STRIDE = 24;

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const COLOR_BYTE_OFFSET = 5 * FLOAT_BYTES;

type LineColorComponents = readonly [red: number, green: number, blue: number, alpha: number];

/** Stores compact line instances in reusable CPU memory. */
export class LineInstanceBuffer {
	private bytes: Uint8Array;
	private view: DataView;
	private _count = 0;

	/**
	 * Allocates storage for an initial number of line instances.
	 *
	 * @param initialCapacity - Positive number of line records to retain initially.
	 */
	constructor(initialCapacity: number) {
		if (!Number.isInteger(initialCapacity) || initialCapacity <= 0) {
			throw new RangeError('initialCapacity must be a positive integer.');
		}
		this.bytes = new Uint8Array(initialCapacity * LINE_INSTANCE_BYTE_STRIDE);
		this.view = new DataView(this.bytes.buffer);
	}

	/** Number of line records written for the current frame. */
	get count(): number {
		return this._count;
	}

	/** Number of line records that fit without another CPU allocation. */
	get capacity(): number {
		return this.bytes.byteLength / LINE_INSTANCE_BYTE_STRIDE;
	}

	/** Resets the write cursor while retaining allocated storage. */
	reset(): void {
		this._count = 0;
	}

	/**
	 * Appends one unchecked line record to the reusable storage.
	 *
	 * Invalid numeric or color input is a programmer error with unspecified consequences.
	 *
	 * @param x1 - Starting X coordinate in canvas pixels.
	 * @param y1 - Starting Y coordinate in canvas pixels.
	 * @param x2 - Ending X coordinate in canvas pixels.
	 * @param y2 - Ending Y coordinate in canvas pixels.
	 * @param thickness - Full line thickness in canvas pixels.
	 * @param color - Red, green, blue, and alpha components in the range 0 to 1.
	 */
	append(x1: number, y1: number, x2: number, y2: number, thickness: number, color: LineColorComponents): void {
		this.ensureCapacity(this._count + 1);
		const offset = this._count * LINE_INSTANCE_BYTE_STRIDE;
		this.view.setFloat32(offset, x1, true);
		this.view.setFloat32(offset + FLOAT_BYTES, y1, true);
		this.view.setFloat32(offset + 2 * FLOAT_BYTES, x2, true);
		this.view.setFloat32(offset + 3 * FLOAT_BYTES, y2, true);
		this.view.setFloat32(offset + 4 * FLOAT_BYTES, thickness, true);
		this.bytes[offset + COLOR_BYTE_OFFSET] = Math.round(color[0] * 255);
		this.bytes[offset + COLOR_BYTE_OFFSET + 1] = Math.round(color[1] * 255);
		this.bytes[offset + COLOR_BYTE_OFFSET + 2] = Math.round(color[2] * 255);
		this.bytes[offset + COLOR_BYTE_OFFSET + 3] = Math.round(color[3] * 255);
		this._count += 1;
	}

	/** Returns a view containing only line records written for this frame. */
	usedBytes(): Uint8Array {
		return this.bytes.subarray(0, this._count * LINE_INSTANCE_BYTE_STRIDE);
	}

	/**
	 * Doubles retained storage until it can hold the requested record count.
	 *
	 * @param requiredCapacity - Minimum number of line records required.
	 */
	private ensureCapacity(requiredCapacity: number): void {
		if (requiredCapacity <= this.capacity) {
			return;
		}
		let nextCapacity = this.capacity;
		while (nextCapacity < requiredCapacity) {
			nextCapacity *= 2;
		}
		const nextBytes = new Uint8Array(nextCapacity * LINE_INSTANCE_BYTE_STRIDE);
		nextBytes.set(this.bytes);
		this.bytes = nextBytes;
		this.view = new DataView(nextBytes.buffer);
	}
}
