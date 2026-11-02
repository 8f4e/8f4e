export interface Dx7Operator {
	rates: number[];
	levels: number[];
	breakpoint: number;
	leftDepth: number;
	rightDepth: number;
	leftCurve: number;
	rightCurve: number;
	rateScaling: number;
	ampModSensitivity: number;
	velocitySensitivity: number;
	outputLevel: number;
	mode: number;
	coarse: number;
	fine: number;
	detune: number;
}

export interface Dx7Patch {
	name: string;
	operators: Dx7Operator[]; // Operator 1 first; SysEx stores operator 6 first.
	pitchRates: number[];
	pitchLevels: number[];
	algorithm: number; // Display numbering, 1..32.
	feedback: number;
	keySync: number;
	lfoSpeed: number;
	lfoDelay: number;
	lfoPitchDepth: number;
	lfoAmplitudeDepth: number;
	lfoSync: number;
	lfoWave: number;
	pitchModSensitivity: number;
	transpose: number; // Semitones relative to the default C3 setting.
}

function decodePatch(data: Uint8Array, packed: boolean): Dx7Patch {
	const operators = Array.from({ length: 6 }, (_, index) => {
		const offset = (5 - index) * (packed ? 17 : 21);
		const op = data.subarray(offset);
		return {
			rates: [...op.subarray(0, 4)],
			levels: [...op.subarray(4, 8)],
			breakpoint: op[8],
			leftDepth: op[9],
			rightDepth: op[10],
			leftCurve: packed ? op[11] & 3 : op[11],
			rightCurve: packed ? (op[11] >> 2) & 3 : op[12],
			rateScaling: packed ? op[12] & 7 : op[13],
			ampModSensitivity: packed ? op[13] & 3 : op[14],
			velocitySensitivity: packed ? (op[13] >> 2) & 7 : op[15],
			outputLevel: op[packed ? 14 : 16],
			mode: packed ? op[15] & 1 : op[17],
			coarse: packed ? (op[15] >> 1) & 31 : op[18],
			fine: op[packed ? 16 : 19],
			detune: packed ? (op[12] >> 3) & 15 : op[20],
		};
	});
	const global = data.subarray(packed ? 102 : 126);
	const name = String.fromCharCode(...global.subarray(packed ? 16 : 19, packed ? 26 : 29)).trim();
	return {
		name,
		operators,
		pitchRates: [...global.subarray(0, 4)],
		pitchLevels: [...global.subarray(4, 8)],
		algorithm: global[8] + 1,
		feedback: packed ? global[9] & 7 : global[9],
		keySync: packed ? (global[9] >> 3) & 1 : global[10],
		lfoSpeed: global[packed ? 10 : 11],
		lfoDelay: global[packed ? 11 : 12],
		lfoPitchDepth: global[packed ? 12 : 13],
		lfoAmplitudeDepth: global[packed ? 13 : 14],
		lfoSync: packed ? global[14] & 1 : global[15],
		lfoWave: packed ? (global[14] >> 1) & 7 : global[16],
		pitchModSensitivity: packed ? (global[14] >> 4) & 7 : global[17],
		transpose: global[packed ? 15 : 18] - 24,
	};
}

/** Read one or more concatenated DX7 single-voice or 32-voice SysEx dumps. */
export function decodeDx7(data: Uint8Array): Dx7Patch[] {
	if (data.length === 0) throw new Error('Empty DX7 SysEx file.');
	const patches: Dx7Patch[] = [];
	for (let offset = 0; offset < data.length; ) {
		if (data[offset] !== 0xf0 || data[offset + 1] !== 0x43 || data[offset + 2] > 15) {
			throw new Error(`Expected a Yamaha DX7 voice dump at byte ${offset}.`);
		}
		const format = data[offset + 3];
		const packed = format === 9;
		if (!packed && format !== 0) throw new Error(`Unsupported DX7 SysEx format: ${format}.`);
		const size = packed ? 4096 : 155;
		const declaredSize = (data[offset + 4] << 7) | data[offset + 5];
		const end = offset + 6 + size;
		if (declaredSize !== size || end + 2 > data.length || data[end + 1] !== 0xf7) {
			throw new Error(`Invalid or truncated DX7 voice dump at byte ${offset}.`);
		}
		const payload = data.subarray(offset + 6, end);
		if (payload.some(byte => byte > 127) || data[end] > 127) throw new Error('DX7 data must contain 7-bit bytes.');
		if ((payload.reduce((sum, byte) => sum + byte, data[end]) & 127) !== 0) {
			throw new Error(`Invalid DX7 checksum at byte ${offset}.`);
		}
		const stride = packed ? 128 : 155;
		for (let i = 0; i < size; i += stride) {
			patches.push(decodePatch(payload.subarray(i, i + stride), packed));
		}
		offset = end + 2;
	}
	return patches;
}
