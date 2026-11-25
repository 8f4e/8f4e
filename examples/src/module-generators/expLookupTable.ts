const exp = new Array(512).fill(0).map((value, index) => {
	return Math.exp(index / 512 - 1);
});

const expLookupTable = `entry main
module expLUT
; @public

${exp
	.map(value => {
		return `float ${value.toFixed(4)}`;
	})
	.join('\n')}

moduleEnd
entryEnd`;

export default expLookupTable;
