export const ORBIT_COLUMNS = 8;
export const ORBIT_ROWS = 4;
export const ORBIT_STEP_MS = 78;

// The full 8×4 perimeter occupies a square with the standard 8×16 VGA cells.
const PATH = [
	[7, 1],
	[7, 2],
	[7, 3],
	[6, 3],
	[5, 3],
	[4, 3],
	[3, 3],
	[2, 3],
	[1, 3],
	[0, 3],
	[0, 2],
	[0, 1],
	[0, 0],
	[1, 0],
	[2, 0],
	[3, 0],
	[4, 0],
	[5, 0],
	[6, 0],
	[7, 0],
] as const;
const TAPER = '○•∙·';

/** Space-padded CP437 text rows for each clockwise step of the 8×4 loader. */
export const ORBIT_FRAMES = PATH.map((_, head) => {
	const rows = Array.from({ length: ORBIT_ROWS }, () => Array<string>(ORBIT_COLUMNS).fill(' '));
	for (const [index, [x, y]] of PATH.entries()) {
		rows[y][x] = TAPER[(head + PATH.length - index) % PATH.length] ?? ' ';
	}
	return rows.map(row => row.join(''));
});
