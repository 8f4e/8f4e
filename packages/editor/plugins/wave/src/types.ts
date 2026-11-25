import type { PreparedAddressBinding, PreparedBuffer } from '@8f4e/editor-state/memory';
import type { WaveformPeaks } from './helpers/peaks';

export interface Wave {
	x: number;
	y: number;
	width: number;
	columnWidth: number;
	height: number;
	buffer: PreparedBuffer;
	playhead?: PreparedAddressBinding;
	inverseElementByteSize: number;
	minValue: number;
	maxValue: number;
	inverseValueRange: number;
	peaks: WaveformPeaks;
}
