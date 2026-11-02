export function dump(payload: Uint8Array, format: number): Uint8Array {
	const checksum = -payload.reduce((sum, byte) => sum + byte, 0) & 127;
	return new Uint8Array([
		0xf0,
		0x43,
		0x00,
		format,
		payload.length >> 7,
		payload.length & 127,
		...payload,
		checksum,
		0xf7,
	]);
}

// Independently encoded VMEM and VCED versions of the same synthetic voice.
export function packedVoice(name = 'Alpha'): Uint8Array {
	const data = new Uint8Array(128);
	for (let i = 0; i < 6; i++) {
		data.set([99, 60, 40, 70, 99, 88, 77, 0], i * 17);
		data[i * 17 + 12] = 7 << 3;
		data[i * 17 + 14] = 99;
		data[i * 17 + 15] = 2;
	}
	// Operator 1: curves 2/1, rate scaling 3, detune 11, AMS 1, velocity 6.
	data.set([39, 12, 23, 6, 91, 25, 83, 6, 25], 85 + 8);
	// Operator 5: fixed mode, fine 30, negative detune (ignored in fixed mode).
	data[17 + 12] = 6 << 3;
	data[17 + 15] = 1;
	data[17 + 16] = 30;
	data.set([99, 98, 97, 96, 50, 50, 50, 50, 4, 13, 25, 40, 20, 30, 91, 12], 102);
	data.set(Buffer.from(name.padEnd(10).slice(0, 10)), 118);
	return data;
}

export function singleVoice(): Uint8Array {
	const data = new Uint8Array(155);
	for (let i = 0; i < 6; i++) {
		data.set([99, 60, 40, 70, 99, 88, 77, 0], i * 21);
		data[i * 21 + 16] = 99;
		data[i * 21 + 18] = 1;
		data[i * 21 + 20] = 7;
	}
	data.set([39, 12, 23, 2, 1, 3, 1, 6, 83, 0, 3, 25, 11], 105 + 8);
	data[21 + 17] = 1;
	data[21 + 18] = 0;
	data[21 + 19] = 30;
	data[21 + 20] = 6;
	data.set([99, 98, 97, 96, 50, 50, 50, 50, 4, 5, 1, 25, 40, 20, 30, 1, 5, 5, 12], 126);
	data.set(Buffer.from('Alpha     '), 145);
	return data;
}

export function bank(): Uint8Array {
	const data = new Uint8Array(4096);
	for (let i = 0; i < 32; i++) data.set(packedVoice(i === 0 ? 'Alpha' : `Alpha ${i + 1}`), i * 128);
	data[128 + 110] = 31;
	return dump(data, 9);
}
