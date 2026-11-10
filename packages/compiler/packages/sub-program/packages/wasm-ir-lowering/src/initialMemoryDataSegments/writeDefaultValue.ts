import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

/**
 * Writes one memory declaration default value into a data segment byte view.
 *
 * @param view - DataView receiving the encoded bytes.
 * @param memory - Planned memory declaration being materialized.
 * @param byteAddress - Byte address where the value should be written.
 * @param value - Default value to write.
 * @returns Nothing.
 */
export default function writeDefaultValue(
	view: DataView,
	memory: Pick<PlannedMemoryDeclaration, 'isInteger' | 'isUnsigned' | 'elementWordSize'>,
	byteAddress: number,
	value: number
) {
	if (memory.isInteger && memory.elementWordSize === 1) {
		if (memory.isUnsigned) {
			view.setUint8(byteAddress, Math.trunc(value));
		} else {
			view.setInt8(byteAddress, Math.trunc(value));
		}
		return;
	}

	if (memory.isInteger && memory.elementWordSize === 2) {
		if (memory.isUnsigned) {
			view.setUint16(byteAddress, Math.trunc(value), true);
		} else {
			view.setInt16(byteAddress, Math.trunc(value), true);
		}
		return;
	}

	if (memory.elementWordSize === 8 && !memory.isInteger) {
		view.setFloat64(byteAddress, value, true);
		return;
	}

	if (memory.isInteger) {
		view.setInt32(byteAddress, Math.trunc(value), true);
		return;
	}

	view.setFloat32(byteAddress, value, true);
}
