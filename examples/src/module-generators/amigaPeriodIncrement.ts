// PAL Amiga clock speed in Hz
const AMIGA_CLOCK = 3546895;

// Standard ProTracker period table — 3 octaves × 12 notes
// Note names follow the midiCodes naming convention (e.g. C#1, D#2)
const periods: [string, number][] = [
	['C1', 856],
	['C#1', 808],
	['D1', 762],
	['D#1', 720],
	['E1', 678],
	['F1', 640],
	['F#1', 604],
	['G1', 570],
	['G#1', 538],
	['A1', 508],
	['A#1', 480],
	['B1', 453],

	['C2', 428],
	['C#2', 404],
	['D2', 381],
	['D#2', 360],
	['E2', 339],
	['F2', 320],
	['F#2', 302],
	['G2', 285],
	['G#2', 269],
	['A2', 254],
	['A#2', 240],
	['B2', 226],

	['C3', 214],
	['C#3', 202],
	['D3', 190],
	['D#3', 180],
	['E3', 170],
	['F3', 160],
	['F#3', 151],
	['G3', 143],
	['G#3', 135],
	['A3', 127],
	['A#3', 120],
	['B3', 113],
];

const amigaPeriodIncrement = `constants amigaPeriodIncrement
; @public
; @tab 12
use env

${periods
	.map(([name, period]) => {
		const freq = (AMIGA_CLOCK / period).toFixed(4);
		return `const ${name}\t${freq}/SAMPLE_RATE`;
	})
	.join('\n')}

constantsEnd`;

const testSupportConstants = `constants env
const SAMPLE_RATE 48000
const AUDIO_BUFFER_SIZE 128
constantsEnd`;

export default `entry main
entryEnd

${amigaPeriodIncrement}

${testSupportConstants}`;
