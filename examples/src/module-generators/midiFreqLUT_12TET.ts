const A = 440;

const midiFrequencies = new Array(128).fill(0).map((value, note) => {
	return (A / 32) * 2 ** ((note - 9) / 12);
});

const midiFrequenciesLookupTable = `entry main
module midiLUT
; @public
; @tab 7 18
${midiFrequencies
	.map((value, index) => {
		return `float	${value.toFixed(4)}	; ${index}`;
	})
	.join('\n')}

moduleEnd
entryEnd`;

export default midiFrequenciesLookupTable;
