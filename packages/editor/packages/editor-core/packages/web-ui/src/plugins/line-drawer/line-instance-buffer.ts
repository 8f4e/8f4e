import { LINE_INSTANCE_BYTE_STRIDE, LINE_INSTANCE_LAYOUT, type LineColor } from './line-instance';

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

	/** Number of bytes occupied by this frame's line records. */
	get usedByteLength(): number {
		return this._count * LINE_INSTANCE_BYTE_STRIDE;
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
	 * @param thickness - Positive integer thickness in canvas pixels.
	 * @param color - Red, green, blue, and alpha components in the range 0 to 1.
	 */
	append(x1: number, y1: number, x2: number, y2: number, thickness: number, color: LineColor): void {
		this.ensureCapacity(this._count + 1);
		const offset = this._count * LINE_INSTANCE_BYTE_STRIDE;
		this.view.setFloat32(offset + LINE_INSTANCE_LAYOUT.x1, x1, true);
		this.view.setFloat32(offset + LINE_INSTANCE_LAYOUT.y1, y1, true);
		this.view.setFloat32(offset + LINE_INSTANCE_LAYOUT.x2, x2, true);
		this.view.setFloat32(offset + LINE_INSTANCE_LAYOUT.y2, y2, true);
		this.view.setFloat32(offset + LINE_INSTANCE_LAYOUT.thickness, thickness, true);
		this.bytes[offset + LINE_INSTANCE_LAYOUT.color] = Math.round(color[0] * 255);
		this.bytes[offset + LINE_INSTANCE_LAYOUT.color + 1] = Math.round(color[1] * 255);
		this.bytes[offset + LINE_INSTANCE_LAYOUT.color + 2] = Math.round(color[2] * 255);
		this.bytes[offset + LINE_INSTANCE_LAYOUT.color + 3] = Math.round(color[3] * 255);
		this._count += 1;
	}

	/** Retained full-storage view; upload only `usedByteLength` bytes and skip empty uploads. */
	get fullBytes(): Uint8Array {
		return this.bytes;
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
